import { parseFragment } from 'parse5'
import type { Diagnostic } from '@shared/models/diagnostic'
import type { ThemeProfile } from '@shared/models/theme'
import { allowedColors, allowedFontSizes } from '../../themes/schema'
import { normalizeFontFamily } from '../styles/css-guard'
import { ROLES } from '@shared/roles'
import { SVG_ALLOWED_ATTRS, SVG_TAGS } from '../html/svg-policy'
import { IMAGE_ALLOWED_ATTRS, isSafeImageSrc } from '@shared/image-policy'

const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'picture',
  'video',
  'audio',
  'form',
  'input',
  'button',
  'canvas',
])

interface AnyNode {
  nodeName: string
  tagName?: string
  value?: string
  attrs?: Array<{ name: string; value: string }>
  childNodes?: AnyNode[]
}

export interface InvariantInput {
  html: string
  text: string
  plainText: string
  theme: ThemeProfile
  placeholders: string[]
  sourceChars: number
}

function parseStyle(style: string): Array<[string, string]> {
  return style
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf(':')
      if (index < 0) return [part, ''] as [string, string]
      return [part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim()] as [string, string]
    })
}

function colorsInStyle(declarations: Array<[string, string]>): string[] {
  const colors: string[] = []
  for (const [property, value] of declarations) {
    if (property === 'color' || property === 'background-color') {
      colors.push(value.toLowerCase())
    } else if (property.startsWith('border')) {
      const match = /#[0-9a-f]{3,8}/i.exec(value)
      if (match) colors.push(match[0].toLowerCase())
    }
  }
  return colors
}

export function checkInvariants(input: InvariantInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const fragment = parseFragment(input.html) as unknown as AnyNode
  const fontSizes = allowedFontSizes(input.theme)
  const colors = allowedColors(input.theme)
  let elementCount = 0
  let missingStyle = 0

  const visit = (node: AnyNode, insidePre: boolean, depth: number) => {
    if (node.nodeName === '#text') return
    const tag = (node.tagName ?? '').toLowerCase()
    if (!tag) {
      for (const child of node.childNodes ?? []) visit(child, insidePre, depth)
      return
    }
    elementCount += 1
    if (FORBIDDEN_TAGS.has(tag)) {
      diagnostics.push({
        id: `invariant.forbidden-tag:${diagnostics.length + 1}`,
        code: 'invariant.violation',
        severity: 'error',
        message: `排版结果中含微信禁止的 <${tag}> 标签。`,
        review: true,
      })
    }
    const isSvg = SVG_TAGS.has(tag)
    const allowedSvgAttrs = isSvg ? SVG_ALLOWED_ATTRS[tag] : null
    const attrs = node.attrs ?? []
    for (const attr of attrs) {
      const attrLower = attr.name.toLowerCase()
      if (attrLower !== 'style' && (!allowedSvgAttrs || !allowedSvgAttrs.has(attrLower)) && !(tag === 'img' && IMAGE_ALLOWED_ATTRS.has(attrLower))) {
        diagnostics.push({
          id: `invariant.forbidden-attr:${diagnostics.length + 1}`,
          code: 'invariant.violation',
          severity: 'error',
          message: `排版结果中含未允许的属性「${attr.name}」。`,
          review: true,
        })
      }
    }
    const styleAttr = attrs.find((attr) => attr.name === 'style')
    if (tag === 'img' && !isSafeImageSrc(attrs.find((attr) => attr.name === 'src')?.value ?? '')) {
      diagnostics.push({ id: `invariant.image-src:${diagnostics.length + 1}`, code: 'invariant.violation', severity: 'error', message: '图片缺少有效地址。', review: true })
    }
    const structural = ['br', 'hr', 'thead', 'tbody', 'tr', 'col', 'colgroup', ...Array.from(SVG_TAGS)]
    if (!styleAttr && !structural.includes(tag)) missingStyle += 1

    if (styleAttr && !insidePre && !isSvg) {
      const declarations = parseStyle(styleAttr.value)
      const isDividerStyle = declarations.some(
        ([property, value]) => property === 'height' && (value === '1px' || value === '0'),
      )
      for (const [property, value] of declarations) {
        if (property === 'font-size' && !isDividerStyle) {
          const size = Number(value.replace('px', ''))
          if (!fontSizes.has(size)) {
            diagnostics.push({
              id: `invariant.font-size:${diagnostics.length + 1}`,
              code: 'invariant.violation',
              severity: 'error',
              message: `输出字号 ${value} 不在当前主题允许的字号档位内。`,
              review: true,
            })
          }
        }
        if (property === 'font-family') {
          const stacks = [input.theme.font.body, input.theme.font.heading, input.theme.font.mono].map(
            (stack) => normalizeFontFamily(stack),
          )
          if (!stacks.includes(normalizeFontFamily(value))) {
            diagnostics.push({
              id: `invariant.font-family:${diagnostics.length + 1}`,
              code: 'invariant.violation',
              severity: 'error',
              message: '输出字体不在当前主题允许的字体栈内。',
              review: true,
            })
          }
        }
      }
      for (const color of colorsInStyle(declarations)) {
        if (!colors.has(color)) {
          diagnostics.push({
            id: `invariant.color:${diagnostics.length + 1}`,
            code: 'invariant.violation',
            severity: 'error',
            message: `输出颜色 ${color} 不在当前主题调色板内。`,
            review: true,
          })
        }
      }
    }

    const childTag = tag
    const nextInsidePre = insidePre || childTag === 'pre'
    const children = node.childNodes ?? []
    const isEmptyBlock =
      children.length === 0 &&
      depth > 1 &&
      ['section', 'p', 'li', 'td', 'th', 'ul', 'ol'].includes(childTag)
    if (isEmptyBlock) {
      const classes = styleAttr?.value ?? ''
      const isDivider = classes.includes('height:1px') || classes.includes('height:0')
      if (!isDivider) {
        diagnostics.push({
          id: `invariant.empty-block:${diagnostics.length + 1}`,
          code: 'invariant.violation',
          severity: 'error',
          message: `排版结果中存在多余的空块 <${childTag}>。`,
          review: true,
        })
      }
    }
    for (const child of children) visit(child, nextInsidePre, depth + 1)
  }

  visit(fragment, false, 0)

  if (elementCount > 0 && missingStyle > 0) {
    diagnostics.push({
      id: 'invariant.missing-style:1',
      code: 'invariant.violation',
      severity: 'error',
      message: `有 ${missingStyle} 个元素缺少内联样式，复制到微信后可能样式失效。`,
      review: true,
    })
  }

  if (input.placeholders.length > 0) {
    const htmlPlaceholders = input.text.split('TODO： ').length - 1
    const plainPlaceholders = input.plainText.split('TODO： ').length - 1
    if (htmlPlaceholders !== input.placeholders.length || plainPlaceholders !== input.placeholders.length) {
      diagnostics.push({
        id: 'invariant.placeholder-mismatch:1',
        code: 'invariant.violation',
        severity: 'error',
        message: `媒体占位符数量与正文不一致（预期 ${input.placeholders.length} 个，实际 ${htmlPlaceholders} 个）。`,
        review: true,
      })
    }
    for (const placeholder of input.placeholders) {
      if (!input.text.includes(placeholder) || !input.plainText.includes(placeholder)) {
        diagnostics.push({
          id: `invariant.placeholder-missing:${diagnostics.length + 1}`,
          code: 'invariant.violation',
          severity: 'error',
          message: `占位符「${placeholder}」在转换结果中丢失。`,
          review: true,
        })
      }
    }
  }

  const ratio = input.sourceChars > 0 ? input.plainText.length / input.sourceChars : 1
  if (input.plainText.length > 0 && ratio < 0.3) {
    diagnostics.push({
      id: 'invariant.content-loss:1',
      code: 'invariant.violation',
      severity: 'error',
      message: `转换后正文文字量异常偏少（仅为原文的 ${(ratio * 100).toFixed(0)}%）。`,
      review: true,
    })
  }

  if (input.html.includes('class="') || input.html.includes('id="')) {
    diagnostics.push({
      id: 'invariant.class-left:1',
      code: 'invariant.violation',
      severity: 'error',
      message: '输出内容仍残留 class 或 id 属性，微信后台可能会过滤或破坏排版。',
      review: true,
    })
  }

  return diagnostics
}

export const ROOT_ROLE = ROLES.root
