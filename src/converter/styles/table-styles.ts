import * as csstree from 'css-tree'
import { parseFragment } from 'parse5'
import type { CompileContext, MdNode } from '../pipeline/types'
import type { HElement, HNode } from '../html/build-hast'
import { sliceSource, transform } from '../pipeline/ast'
import { filterStyle, normalizeFontFamily } from './css-guard'

type Target = 'table' | 'th' | 'td'
interface Declaration {
  property: string
  value: string
  important: boolean
}
export interface TableStyleRule {
  target: Target
  specificity: number
  declarations: Declaration[]
}

const PROPERTIES = new Set([
  'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'color', 'background-color', 'text-align', 'vertical-align',
  'white-space', 'word-break', 'overflow-wrap', 'width', 'max-width',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-collapse',
  ...['padding', 'margin'].flatMap(name => ['top', 'right', 'bottom', 'left'].map(side => `${name}-${side}`)),
])
const INHERITED = new Set([
  'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'color',
  'text-align', 'white-space', 'word-break', 'overflow-wrap',
])

function expand(property: string, value: string): Array<[string, string]> {
  if (property !== 'padding' && property !== 'margin') return [[property, value]]
  const parts = value.split(/\s+/)
  if (!parts.length || parts.length > 4 || parts.some(part => !/^(?:0|\d+(?:\.\d+)?px)$/.test(part))) return []
  const [top, right = top, bottom = top, left = right] = parts
  return ['top', 'right', 'bottom', 'left'].map((side, index) => [`${property}-${side}`, [top, right, bottom, left][index]])
}

function parseRules(css: string, ctx: CompileContext): { rules: TableStyleRule[]; skipped: boolean } {
  const rules: TableStyleRule[] = []
  let skipped = false
  const fonts = new Set([ctx.theme.font.body, ctx.theme.font.heading, ctx.theme.font.mono].map(normalizeFontFamily))
  try {
    const ast = csstree.parse(css, { context: 'stylesheet', onParseError: () => { skipped = true } })
    if (ast.type !== 'StyleSheet') return { rules, skipped: true }
    for (const rule of ast.children) {
      if (rule.type !== 'Rule' || rule.prelude.type !== 'SelectorList') {
        skipped = true
        continue
      }
      const declarations: Declaration[] = []
      for (const node of rule.block.children) {
        if (node.type !== 'Declaration' || node.value.type === 'Raw') {
          skipped = true
          continue
        }
        const expanded = expand(node.property.toLowerCase(), csstree.generate(node.value))
        if (!expanded.length) skipped = true
        for (const [property, value] of expanded) {
          const filtered = PROPERTIES.has(property) ? filterStyle(`${property}:${value}`, fonts) : null
          const fontSize = property === 'font-size' ? /^(\d+(?:\.\d+)?)px$/.exec(value) : null
          if (!filtered?.style || filtered.dropped.length ||
              (property === 'font-size' && (!fontSize || Number(fontSize[1]) < 10 || Number(fontSize[1]) > 48))) {
            skipped = true
            continue
          }
          declarations.push({ property, value: filtered.style.slice(property.length + 1), important: Boolean(node.important) })
        }
      }
      for (const selector of rule.prelude.children) {
        const value = csstree.generate(selector).toLowerCase().trim()
        if (!/^(?:table|th|td|table\s+(?:th|td))$/.test(value)) {
          skipped = true
          continue
        }
        const parts = value.split(/\s+/)
        if (declarations.length) rules.push({ target: parts.at(-1) as Target, specificity: parts.length, declarations })
      }
    }
  } catch {
    skipped = true
  }
  return { rules, skipped }
}

/** Consume standalone style blocks before raw HTML is classified as text.
 * Only table selectors and validated declarations enter the rendering stage. */
export function extractTableStyles(root: MdNode, ctx: CompileContext): TableStyleRule[] {
  const rules: TableStyleRule[] = []
  const replaced = transform(root, node => {
    if (node.type !== 'html' || !/^\s*<style(?:\s[^<>]*?)?>[\s\S]*<\/style\s*>\s*$/i.test(String(node.value))) return node
    const fragment = parseFragment(String(node.value))
    const styles = fragment.childNodes.filter(child => child.nodeName !== '#comment' && !('value' in child && !child.value.trim()))
    if (styles.some(child => child.nodeName !== 'style')) return node
    let skipped = false
    for (const style of styles) {
      if (!('tagName' in style)) continue
      if (style.attrs.some(attr => attr.name !== 'type' || attr.value.toLowerCase() !== 'text/css')) {
        skipped = true
        continue
      }
      const css = style.childNodes.map(child => 'value' in child ? child.value : '').join('')
      const parsed = parseRules(css, ctx)
      rules.push(...parsed.rules)
      skipped ||= parsed.skipped
    }
    ctx.counters.inlineMarkupChars += sliceSource(ctx.source, node).length
    if (skipped) ctx.diagnostics.push({
      code: 'table.unsupported-style', severity: 'warning',
      message: '表格样式中有未支持的选择器、属性或取值，已忽略这些规则。',
      action: '已转换支持的表格样式。',
      advice: '使用 table、th、td、table th、table td 选择器，以及像素字号、行高、间距、边框等静态样式。',
      review: true, span: ctx.spanOf(node),
    })
    return null
  })
  if (replaced) root.children = replaced.children
  return rules
}

/** Resolve the supported selector cascade before theme inlining. Explicit user
 * declarations then override theme defaults without shipping a style element. */
export function applyTableStyles(root: HElement, rules: TableStyleRule[], ctx: CompileContext): void {
  if (!rules.length) return
  const styles = new Map<Target, Map<string, Declaration>>()
  for (const target of ['table', 'th', 'td'] as const) {
    const winners = new Map<string, Declaration & { specificity: number }>()
    for (const rule of rules) {
      if (rule.target !== target) continue
      for (const declaration of rule.declarations) {
        const previous = winners.get(declaration.property)
        if (!previous || Number(declaration.important) > Number(previous.important) ||
            (declaration.important === previous.important && rule.specificity >= previous.specificity)) {
          winners.set(declaration.property, { ...declaration, specificity: rule.specificity })
        }
      }
    }
    styles.set(target, winners)
  }
  const visit = (node: HNode, inherited: Map<string, string>, inTable: boolean): void => {
    if (node.type !== 'element') return
    inTable ||= node.tagName === 'table'
    if (!inTable) {
      node.children.forEach(child => visit(child, inherited, false))
      return
    }
    const own = new Map((node.properties.style ?? '').split(';').filter(Boolean).map(part => {
      const colon = part.indexOf(':')
      return [part.slice(0, colon), part.slice(colon + 1)]
    }))
    const effective = new Map(inherited)
    for (const [property, value] of own) effective.set(property, value)
    for (const [property, declaration] of styles.get(node.tagName as Target) ?? []) {
      if (!own.has(property) || declaration.important) effective.set(property, declaration.value)
    }
    if (effective.size) {
      node.properties.style = [...effective].map(([property, value]) => `${property}:${value}`).join(';')
      for (const [property, value] of effective) {
        if (property === 'font-size') ctx.inlineFontSizes.add(Number.parseFloat(value))
        if (property === 'color' || property === 'background-color' || property.startsWith('border')) {
          for (const color of value.match(/#[\da-f]{3,8}/gi) ?? []) ctx.inlineColors.add(color.toLowerCase())
        }
      }
    }
    const next = new Map([...effective].filter(([property]) => INHERITED.has(property)))
    node.children.forEach(child => visit(child, next, true))
  }
  visit(root, new Map(), false)
}
