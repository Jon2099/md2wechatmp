import { ROLES } from '@shared/roles'
import type { HElement, HNode } from '../html/build-hast'

const HEADING_ROLES = [ROLES.h1, ROLES.h2, ROLES.h3, ROLES.h4, ROLES.h5, ROLES.h6]
const BLOCK_ROLES = new Set<string>([
  ROLES.p,
  ROLES.notice,
  ROLES.eyebrow,
  ROLES.calloutTitle,
  ROLES.sectionTitle,
  ROLES.footnoteItem,
  ...HEADING_ROLES,
])

function isEl(node: HNode | undefined): node is HElement {
  return node !== undefined && node.type === 'element'
}

function classesOf(node: HElement): string[] {
  return node.properties.className ?? []
}

function hasRole(node: HElement, role: string): boolean {
  return classesOf(node).includes(role)
}

function indentLines(value: string, size: number): string {
  const pad = ' '.repeat(size)
  return value
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n')
}

export function inlineTextOf(node: HNode): string {
  if (node.type === 'text') return node.value
  if (node.type === 'raw') return node.rawText ?? ''
  if (node.tagName === 'br') return '\n'
  if (node.tagName === 'img') return `[图片：${node.properties.alt || '图片'}]`
  if (node.tagName === 'code') {
    const raw = node.children.map((child) => inlineTextOf(child)).join('')
    return raw.includes('`') ? raw : `\`${raw}\``
  }
  return node.children.map((child) => inlineTextOf(child)).join('')
}

function rawTextOf(node: HNode): string {
  if (node.type === 'text') return node.value
  if (node.type === 'raw') return node.rawText ?? ''
  return node.children.map((child) => rawTextOf(child)).join('')
}

function renderCodeBlock(node: HElement): string {
  const raw = rawTextOf(node)
  return `\`\`\`\n${raw.replace(/\n$/, '')}\n\`\`\``
}

function renderTable(node: HElement): string {
  const rows: string[][] = []
  const visit = (element: HElement) => {
    if (element.tagName === 'tr') {
      rows.push(element.children.map((cell) => inlineTextOf(cell).replace(/\s+/g, ' ').trim()))
      return
    }
    for (const child of element.children) {
      if (isEl(child)) visit(child)
    }
  }
  visit(node)
  if (rows.length === 0) return ''
  const lines = [rows[0].join(' | '), rows[0].map(() => '---').join(' | ')]
  for (const row of rows.slice(1)) lines.push(row.join(' | '))
  return lines.join('\n')
}

function renderList(list: HElement, depth: number): string {
  const ordered = list.tagName === 'ol'
  const lines: string[] = []
  let index = 0
  for (const item of list.children) {
    if (!isEl(item)) continue
    index += 1
    let marker = ordered ? `${index}. ` : '- '
    let rest: HNode[] = item.children
    const first = rest[0]
    if (first && first.type === 'text') {
      const matched = /^(· |☐ |☑ |\d+\.\s)/.exec(first.value)
      if (matched) {
        marker = matched[1].endsWith(' ') ? matched[1] : `${matched[1].trim()} `
        rest = [{ type: 'text', value: first.value.slice(matched[1].length) }, ...rest.slice(1)]
      }
    }

    const inlineParts: string[] = []
    const nested: string[] = []
    for (const child of rest) {
      if (isEl(child) && (child.tagName === 'ul' || child.tagName === 'ol')) {
        nested.push(renderList(child, depth + 1))
      } else if (isEl(child) && hasRole(child, ROLES.p)) {
        inlineParts.push(inlineTextOf(child))
      } else {
        inlineParts.push(inlineTextOf(child))
      }
    }
    const body = inlineParts.join('').replace(/\s+$/, '')
    const plainMarker = marker === '· ' ? '- ' : marker
    let line = `${' '.repeat(depth * 2)}${plainMarker}${body}`
    if (nested.length > 0) line += `\n${nested.join('\n')}`
    lines.push(line)
  }
  return lines.join('\n')
}

function renderBlock(node: HNode, out: string[], depth: number): void {
  if (node.type === 'text') {
    const value = node.value.trim()
    if (value) out.push(value)
    return
  }
  if (node.type === 'raw') {
    const value = (node.rawText ?? '').trim()
    if (value) out.push(value)
    return
  }

  const classes = classesOf(node)
  if (node.tagName === 'ul' || node.tagName === 'ol') {
    const rendered = renderList(node, depth)
    if (rendered) out.push(rendered)
    return
  }
  if (node.tagName === 'pre') {
    out.push(renderCodeBlock(node))
    return
  }
  if (node.tagName === 'table') {
    const rendered = renderTable(node)
    if (rendered) out.push(rendered)
    return
  }
  if (classes.includes(ROLES.divider)) {
    out.push('---')
    return
  }
  if (classes.includes(ROLES.quote) || classes.includes(ROLES.callout)) {
    const inner: string[] = []
    for (const child of node.children) renderBlock(child, inner, depth + 1)
    if (inner.length > 0) out.push(indentLines(inner.join('\n\n'), 2))
    return
  }
  if (classes.some((name) => BLOCK_ROLES.has(name))) {
    const value = inlineTextOf(node).trim()
    if (value) out.push(value)
    return
  }
  for (const child of node.children) renderBlock(child, out, depth)
}

export function serializePlainText(root: HElement): string {
  const out: string[] = []
  for (const child of root.children) renderBlock(child, out, 0)
  return out
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
