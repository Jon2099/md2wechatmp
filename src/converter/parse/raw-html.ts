import { parseFragment, serializeOuter } from 'parse5'
import type { MediaType } from '@shared/models/snapshot'
import type { MdNode } from '../pipeline/types'

export type RawImageKind = 'img' | 'svg' | 'picture' | 'video' | 'iframe'

export type RawInline =
  | { kind: 'text'; value: string }
  | { kind: 'br' }
  | { kind: 'wrap'; tag: 'sub' | 'sup' | 'u'; children: RawInline[] }
  | { kind: 'image'; src: string | null; imageKind: RawImageKind; mediaType: MediaType; alt?: string; svgSource?: string }

export interface RawHtmlResult {
  inline: RawInline[]
  blocked: string[]
}

const ALLOWED_INLINE = new Set(['sub', 'sup', 'u'])

interface AnyNode {
  nodeName: string
  tagName?: string
  value?: string
  attrs?: Array<{ name: string; value: string }>
  childNodes?: AnyNode[]
}

function attrOf(node: AnyNode, name: string): string | null {
  const attrs = node.attrs ?? []
  const found = attrs.find((attr) => attr.name === name)
  return found ? found.value : null
}

function findFirstTag(node: AnyNode, tag: string): AnyNode | null {
  for (const child of node.childNodes ?? []) {
    if (child.tagName === tag) return child
    const nested = findFirstTag(child, tag)
    if (nested) return nested
  }
  return null
}

function walkNodes(nodes: AnyNode[], blocked: string[]): RawInline[] {
  const result: RawInline[] = []
  for (const node of nodes) {
    if (node.nodeName === '#text') {
      if (node.value) result.push({ kind: 'text', value: node.value })
      continue
    }
    if (node.tagName === 'br') {
      result.push({ kind: 'br' })
      continue
    }
    if (node.tagName === 'img') {
      result.push({ kind: 'image', src: attrOf(node, 'src'), imageKind: 'img', mediaType: 'image', alt: attrOf(node, 'alt') ?? '' })
      continue
    }
    if (node.tagName === 'svg') {
      result.push({ kind: 'image', src: null, imageKind: 'svg', mediaType: 'image', svgSource: serializeOuter(node as never) })
      continue
    }
    if (node.tagName === 'picture') {
      const img = findFirstTag(node, 'img')
      const src = img ? attrOf(img, 'src') : null
      result.push({ kind: 'image', src, imageKind: 'picture', mediaType: 'image', alt: img ? attrOf(img, 'alt') ?? '' : '' })
      continue
    }
    if (node.tagName === 'video') {
      let src = attrOf(node, 'src')
      if (!src) {
        const source = findFirstTag(node, 'source')
        if (source) src = attrOf(source, 'src')
      }
      result.push({ kind: 'image', src, imageKind: 'video', mediaType: 'video' })
      continue
    }
    if (node.tagName === 'iframe') {
      const src = attrOf(node, 'src')
      result.push({ kind: 'image', src, imageKind: 'iframe', mediaType: 'video' })
      continue
    }
    if (node.tagName && ALLOWED_INLINE.has(node.tagName)) {
      result.push({
        kind: 'wrap',
        tag: node.tagName as 'sub' | 'sup' | 'u',
        children: walkNodes(node.childNodes ?? [], blocked),
      })
      continue
    }
    if (node.tagName) {
      blocked.push(node.tagName)
      result.push(...walkNodes(node.childNodes ?? [], blocked))
      continue
    }
    result.push(...walkNodes(node.childNodes ?? [], blocked))
  }
  return result
}

export function analyzeRawHtml(value: string): RawHtmlResult {
  const fragment = parseFragment(value) as unknown as AnyNode
  const blocked: string[] = []
  const inline = walkNodes(fragment.childNodes ?? [], blocked)
  return { inline, blocked }
}

/** Inline HTML containers arrive from remark as sibling tags and text. Read
 * each complete media element from the original source before classifying it. */
export function coalesceMediaHtml(root: MdNode, source: string): void {
  const visit = (parent: MdNode) => {
    const children = parent.children ?? []
    const next: MdNode[] = []
    for (let index = 0; index < children.length; index++) {
      const node = children[index]
      const opening = node.type === 'html' ? /^<(svg|picture|video|iframe)(?:\s[^<>]*?)?\s*>$/i.exec(String(node.value)) : null
      if (opening && node.position) {
        const tag = opening[1].toLowerCase()
        let depth = 1
        for (let end = index + 1; end < children.length; end++) {
          const item = children[end]
          if (item.type !== 'html') continue
          const boundary = /^<(\/)?(svg|picture|video|iframe)(?:\s[^<>]*?)?\s*>$/i.exec(String(item.value))
          if (!boundary || boundary[2].toLowerCase() !== tag) continue
          depth += boundary[1] ? -1 : 1
          if (depth === 0 && item.position) {
            node.value = source.slice(node.position.start.offset, item.position.end.offset)
            node.position = { start: node.position.start, end: item.position.end }
            index = end
            break
          }
        }
      }
      visit(node)
      next.push(node)
    }
    if (parent.children) parent.children = next
    if (parent.wxTitle) {
      const title = { type: 'root', children: parent.wxTitle }
      visit(title)
      parent.wxTitle = title.children
    }
  }
  visit(root)
}
