import type { HElement, HNode } from '../html/build-hast'

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input'])

export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function serializeHast(node: HNode): string {
  if (node.type === 'text') return escapeText(node.value)
  if (node.type === 'raw') return node.value
  return serializeElement(node)
}

function serializeElement(node: HElement): string {
  const attrs: string[] = []
  for (const name of ['src', 'alt', 'title', 'referrerpolicy'] as const) {
    const value = node.properties[name]
    if (value !== undefined) attrs.push(` ${name}="${escapeAttr(value)}"`)
  }
  const classes = node.properties.className
  if (classes && classes.length > 0) {
    attrs.push(` class="${escapeAttr(classes.join(' '))}"`)
  }
  if (node.properties.style) {
    attrs.push(` style="${escapeAttr(node.properties.style)}"`)
  }
  const open = `<${node.tagName}${attrs.join('')}>`
  if (VOID_TAGS.has(node.tagName)) return open
  return `${open}${node.children.map((child) => serializeHast(child)).join('')}</${node.tagName}>`
}

export function serializeNodes(nodes: HNode[]): string {
  return nodes.map((node) => serializeHast(node)).join('')
}
