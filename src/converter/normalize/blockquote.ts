import type { MdNode } from '../pipeline/types'
import type { CompileContext } from '../pipeline/types'
import { childrenOf } from '../pipeline/ast'

const BULLET_PREFIX = /^[·•・]\s*/

type CalloutTone = 'note' | 'warn'

const CALLOUT_MARKERS: Record<string, { tone: CalloutTone; title: string }> = {
  NOTE: { tone: 'note', title: '提示' },
  TIP: { tone: 'note', title: '提示' },
  IMPORTANT: { tone: 'note', title: '重点' },
  WARNING: { tone: 'warn', title: '注意' },
  CAUTION: { tone: 'warn', title: '注意' },
  提示: { tone: 'note', title: '提示' },
  注意: { tone: 'warn', title: '注意' },
  警告: { tone: 'warn', title: '警告' },
  重要: { tone: 'note', title: '重点' },
  谨慎: { tone: 'warn', title: '注意' },
}

/** 把段落内联拆成行：硬换行与文本中的软换行都视为行边界 */
function splitLines(children: MdNode[]): MdNode[][] {
  const lines: MdNode[][] = []
  let current: MdNode[] = []
  const flush = () => {
    lines.push(current)
    current = []
  }
  for (const child of children) {
    if (child.type === 'break') {
      flush()
      continue
    }
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('\n')) {
      const parts = child.value.split('\n')
      parts.forEach((part, index) => {
        if (index > 0) flush()
        if (part.trim().length > 0) current.push({ ...child, value: part })
      })
      continue
    }
    current.push(child)
  }
  if (current.length > 0) lines.push(current)
  return lines
}

function joinLines(lines: MdNode[][]): MdNode[] {
  const out: MdNode[] = []
  lines.forEach((line, index) => {
    if (index > 0) out.push({ type: 'break' })
    out.push(...line)
  })
  return out
}

function stripBullet(line: MdNode[]): MdNode[] | null {
  const first = line[0]
  if (!first || first.type !== 'text' || typeof first.value !== 'string') return null
  if (!BULLET_PREFIX.test(first.value)) return null
  const rest = first.value.replace(BULLET_PREFIX, '')
  const next = line.slice()
  if (rest.length > 0) next[0] = { ...first, value: rest }
  else next.shift()
  return next
}

function makeBulletList(lines: MdNode[][]): MdNode {
  return {
    type: 'list',
    ordered: false,
    spread: false,
    children: lines.map((line) => ({
      type: 'listItem',
      spread: false,
      checked: null,
      children: [{ type: 'paragraph', children: line }],
    })),
    data: { wxFromBulletLines: true },
  }
}

/** 段落内所有行都以 `· ` / `• ` 开头时转成静态符号列表 */
function bulletLinesToList(paragraph: MdNode): MdNode | null {
  const children = childrenOf(paragraph)
  if (children.length === 0) return null
  const lines = splitLines(children)
  if (lines.length < 2) return null
  const stripped = lines.map(stripBullet)
  if (stripped.some((line) => line === null)) return null
  return { ...makeBulletList(stripped as MdNode[][]), position: paragraph.position }
}

function tryExtractTitle(paragraph: MdNode): { title: MdNode[]; restLines: MdNode[][] } | null {
  const lines = splitLines(childrenOf(paragraph))
  if (lines.length === 0) return null
  const firstLine = lines[0]
  if (firstLine.length !== 1 || firstLine[0].type !== 'strong') return null
  return { title: childrenOf(firstLine[0]), restLines: lines.slice(1) }
}

function detectMarker(paragraph: MdNode): { tone: CalloutTone; titleText: string } | null {
  const first = childrenOf(paragraph)[0]
  if (!first || first.type !== 'text' || typeof first.value !== 'string') return null
  const match = /^\[!?([A-Za-z\u4e00-\u9fa5]+)\]?\s*[:：]?\s*/.exec(first.value)
  if (!match) return null
  const marker = CALLOUT_MARKERS[match[1]] ?? CALLOUT_MARKERS[match[1].toUpperCase()]
  if (!marker) return null
  const rest = first.value.replace(/^\[!?[A-Za-z\u4e00-\u9fa5]+\]?\s*[:：]?\s*/, '')
  return { tone: marker.tone, titleText: rest || marker.title }
}

function normalizeBody(nodes: MdNode[]): MdNode[] {
  return nodes.map((node) => {
    if (node.type === 'paragraph') return bulletLinesToList(node) ?? node
    if (node.type === 'list') {
      node.children = childrenOf(node).map((item) => {
        item.children = normalizeBody(childrenOf(item))
        return item
      })
      return node
    }
    return node
  })
}

function normalizeBlockquote(node: MdNode, ctx: CompileContext): MdNode {
  const blocks: MdNode[] = []
  let flattened = false
  for (const child of childrenOf(node)) {
    if (child.type === 'blockquote') {
      blocks.push(...childrenOf(child))
      flattened = true
    } else {
      blocks.push(child)
    }
  }
  if (flattened) {
    ctx.diagnostics.push({
      code: 'quote.flattened',
      severity: 'info',
      message: '微信不支持多层引用嵌套，已自动合并为单层展示。',
      action: '保留全部引用文字，合并缩进层级。',
      review: false,
      span: ctx.spanOf(node),
    })
  }

  let title: MdNode[] | null = null
  let tone: CalloutTone = 'note'
  let body: MdNode[] = blocks

  const first = blocks[0]
  if (first && first.type === 'paragraph') {
    const extracted = tryExtractTitle(first)
    if (extracted) {
      title = extracted.title
      const rest: MdNode[] = []
      if (extracted.restLines.length > 0) {
        const stripped = extracted.restLines.map(stripBullet)
        if (stripped.every((line) => line !== null)) {
          rest.push(makeBulletList(stripped as MdNode[][]))
        } else {
          rest.push({ type: 'paragraph', children: joinLines(extracted.restLines) })
        }
      }
      rest.push(...blocks.slice(1))
      body = normalizeBody(rest)
    } else {
      const marker = detectMarker(first)
      if (marker) {
        title = [{ type: 'text', value: marker.titleText }]
        tone = marker.tone
        body = normalizeBody(blocks.slice(1))
      } else {
        body = normalizeBody(blocks)
      }
    }
  } else {
    body = normalizeBody(blocks)
  }

  if (title) {
    ctx.diagnostics.push({
      code: 'callout.converted',
      severity: 'info',
      message: '检测到带有标题的引用段落，已自动排版为重点提示卡片。',
      action: '提取首行加粗文字作为卡片标题，正文保持原样展示。',
      review: false,
      span: ctx.spanOf(node),
    })
    return {
      type: 'wxCallout',
      tone,
      wxTitle: title,
      children: body,
      position: node.position,
    }
  }

  return { ...node, type: 'blockquote', children: body }
}

function normalizeChildBlocks(node: MdNode, ctx: CompileContext): MdNode {
  if (node.type === 'blockquote') return normalizeBlockquote(node, ctx)
  if (node.children) {
    node.children = childrenOf(node).map((child) => normalizeChildBlocks(child, ctx))
  }
  return node
}

export function normalizeBlockquotes(root: MdNode, ctx: CompileContext): void {
  root.children = childrenOf(root).map((child) => normalizeChildBlocks(child, ctx))
}
