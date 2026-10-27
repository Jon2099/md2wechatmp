import type { CompileContext, MdNode } from '../pipeline/types'
import { childrenOf, textOf } from '../pipeline/ast'
import { analyzeRawHtml, type RawInline } from '../parse/raw-html'
import { ROLES, olRole, ulRole } from '@shared/roles'
import { serializeInlineTextStyle, type SourceTextMapping } from '@shared/inline-text-style'
import { sourceTextPieces } from '../serialize/source-mapping'

export interface HText {
  type: 'text'
  value: string
  source?: SourceTextMapping
}

export interface HElement {
  type: 'element'
  tagName: string
  properties: { className?: string[]; style?: string; src?: string; alt?: string; title?: string; referrerpolicy?: string }
  children: HNode[]
}

export interface HRaw {
  type: 'raw'
  value: string
  rawText?: string
}

export type HNode = HText | HElement | HRaw

export function raw(value: string, rawText?: string): HRaw {
  return { type: 'raw', value, rawText }
}

export function el(
  tagName: string,
  className: string | string[] | undefined,
  children: HNode[],
  style?: string,
): HElement {
  const classes = className === undefined ? undefined : Array.isArray(className) ? className : [className]
  return {
    type: 'element',
    tagName,
    properties: { className: classes, style },
    children,
  }
}

export function text(value: string): HText {
  return { type: 'text', value }
}

const HEADING_ROLES = [ROLES.h1, ROLES.h2, ROLES.h3, ROLES.h4, ROLES.h5, ROLES.h6]
const CN_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

class HastBuilder {
  private h2Counter = 0

  constructor(private readonly ctx: CompileContext) {}

  build(root: MdNode): HElement {
    const children: HNode[] = []
    if (this.ctx.meta.eyebrow) {
      children.push(el('section', ROLES.eyebrow, [text(this.ctx.meta.eyebrow)]))
    }
    if (this.ctx.meta.notice) {
      children.push(el('section', ROLES.notice, [text(this.ctx.meta.notice)]))
    }
    children.push(...this.blocks(childrenOf(root)))
    children.push(...this.referenceSections())
    return el('section', ROLES.root, children)
  }

  private blocks(nodes: MdNode[]): HNode[] {
    const out: HNode[] = []
    for (const node of nodes) {
      out.push(...this.block(node))
    }
    return out
  }

  private block(node: MdNode): HNode[] {
    switch (node.type) {
      case 'heading': {
        const depth = Math.min(Math.max(Number(node.depth ?? 1), 1), 6)
        const role = HEADING_ROLES[depth - 1]
        const children = this.inline(childrenOf(node))
        const prefix = this.headingPrefix(depth)
        return [el('section', role, prefix ? [text(prefix), ...children] : children)]
      }
      case 'paragraph': {
        const inline = this.inline(childrenOf(node))
        if (inline.length === 0) return []
        return [el('section', ROLES.p, inline)]
      }
      case 'thematicBreak':
        return [el('section', ROLES.divider, [])]
      case 'blockquote':
        return [el('section', ROLES.quote, this.blocks(childrenOf(node)))]
      case 'wxCallout': {
        const tone = node.tone === 'warn' ? ROLES.calloutWarn : undefined
        const classes = tone ? [ROLES.callout, tone] : [ROLES.callout]
        const titleChildren = Array.isArray(node.wxTitle) ? this.inline(node.wxTitle) : []
        const body = this.blocks(childrenOf(node))
        return [
          el('section', classes, [
            el('section', ROLES.calloutTitle, titleChildren.length > 0 ? titleChildren : [text('提示')]),
            ...body,
          ]),
        ]
      }
      case 'list':
        return [this.list(node, 1)]
      case 'table':
        return [this.table(node)]
      case 'code':
        return [this.code(node)]
      case 'math': {
        if (node.renderedSvg) {
          const rawTex = this.rawOf(node)
          return [el('section', ROLES.mathBlockSvg, [raw(node.renderedSvg as string, rawTex)])]
        }
        return [this.mathBlock(node)]
      }
      case 'html':
        return this.html(node)
      case 'wxImage':
      case 'wxRawInline':
        return [el('section', ROLES.p, this.inline([node]))]
      case 'listItem':
        return [el('li', ROLES.li, this.blocks(childrenOf(node)))]
      case 'definition':
        return []
      default: {
        if (Array.isArray(node.children) && node.children.length > 0) {
          const inline = this.inline(childrenOf(node))
          if (inline.length > 0) return [el('section', ROLES.p, inline)]
          return this.blocks(childrenOf(node))
        }
        const value = String(node.value ?? '')
        return value ? [el('section', ROLES.p, [text(value)])] : []
      }
    }
  }

  private headingPrefix(depth: number): string {
    const numbering = this.ctx.theme.headings.numbering
    if (depth !== 2 || numbering === 'none') return ''
    this.h2Counter += 1
    if (numbering === 'h2-two-digit') {
      return `${String(this.h2Counter).padStart(2, '0')} `
    }
    return `${CN_NUMBERS[this.h2Counter - 1] ?? String(this.h2Counter)}、`
  }

  private list(node: MdNode, depth: number): HElement {
    const ordered = Boolean(node.ordered)
    const isTask = Boolean((node.data ?? {}).wxTaskList)
    const start = typeof node.start === 'number' ? node.start : 1
    const staticMarkers =
      this.ctx.options.listMode === 'static' || (ordered && start !== 1) || isTask
    const classes: string[] = [ROLES.list]
    if (isTask || (ordered && start !== 1) || this.ctx.options.listMode === 'static') {
      classes.push(ROLES.listNone)
    } else {
      classes.push(ordered ? olRole(depth) : ulRole(depth))
    }

    const children: HNode[] = []
    const items = childrenOf(node)
    let index = 0
    for (const item of items) {
      index += 1
      children.push(this.listItem(item, depth, ordered, index, start, isTask, staticMarkers))
    }
    return el(ordered ? 'ol' : 'ul', classes, children)
  }

  private listItem(
    item: MdNode,
    depth: number,
    ordered: boolean,
    index: number,
    start: number,
    isTask: boolean,
    staticMarkers: boolean,
  ): HElement {
    const children: HNode[] = []
    const inlineChildren = childrenOf(item)

    if (isTask) {
      children.push(text(item.checked ? '☑ ' : '☐ '))
    } else if (staticMarkers) {
      children.push(text(ordered ? `${start + index - 1}. ` : '· '))
    }

    let firstParagraphHandled = false
    for (const child of inlineChildren) {
      if (child.type === 'paragraph') {
        const inline = this.inline(childrenOf(child))
        if (firstParagraphHandled) {
          children.push(el('section', ROLES.p, inline))
        } else {
          children.push(...inline)
          firstParagraphHandled = true
        }
        continue
      }
      if (child.type === 'list') {
        children.push(this.list(child, depth + 1))
        continue
      }
      children.push(...this.block(child))
    }

    const element = el('li', ROLES.li, children)
    if (staticMarkers) {
      const indent = this.ctx.theme.list.indentPx
      element.properties.style = `padding-left:${indent}px;text-indent:-${indent}px`
    }
    return element
  }

  private table(node: MdNode): HElement {
    const rows = childrenOf(node)
    const align = Array.isArray(node.align) ? node.align : []
    const compact = Boolean((node.data ?? {}).wxCompact)
    const classes: string[] = [ROLES.table]
    if (compact) classes.push(ROLES.tableCompact)

    const buildRow = (row: MdNode, rowIndex: number, header: boolean): HElement => {
      const cells = childrenOf(row)
      const cellNodes: HNode[] = []
      cells.forEach((cell, cellIndex) => {
        const cellAlign = align[cellIndex] ?? null
        const style = cellAlign === 'center' || cellAlign === 'right' ? `text-align:${cellAlign}` : undefined
        const classesForCell: string[] = header ? [ROLES.th] : [ROLES.td]
        if (!header && this.ctx.theme.table.zebra && rowIndex % 2 === 1) {
          classesForCell.push(ROLES.zebra)
        }
        cellNodes.push(el(header ? 'th' : 'td', classesForCell, this.inline(childrenOf(cell)), style))
      })
      return el('tr', undefined, cellNodes)
    }

    const head = rows.length > 0 ? el('thead', undefined, [buildRow(rows[0], 0, true)]) : null
    const bodyRows = rows.slice(1)
    const body =
      bodyRows.length > 0
        ? el(
            'tbody',
            undefined,
            bodyRows.map((row, index) => buildRow(row, index + 1, false)),
          )
        : null
    const tableChildren: HNode[] = []
    if (head) tableChildren.push(head)
    if (body) tableChildren.push(body)
    return el('table', classes, tableChildren)
  }

  private code(node: MdNode): HElement {
    const tokens = Array.isArray((node.data ?? {}).wxTokens)
      ? ((node.data ?? {}).wxTokens as Array<Array<{ value: string; color: string }>>)
      : null
    const isDiagram = Boolean((node.data ?? {}).wxDiagram)
    const inner: HNode[] = []
    if (tokens && tokens.length > 0) {
      tokens.forEach((line, index) => {
        if (index > 0) inner.push(text('\n'))
        for (const token of line) {
          if (!token.value) continue
          inner.push({
            type: 'element',
            tagName: 'span',
            properties: { style: `color:${token.color}` },
            children: [text(token.value)],
          })
        }
      })
    } else {
      inner.push(text(String(node.value ?? '')))
    }
    const codeClasses = isDiagram ? [ROLES.codeBlock, ROLES.mathBlock] : [ROLES.codeBlock]
    return el('pre', ROLES.pre, [el('code', codeClasses, inner)])
  }

  private mathBlock(node: MdNode): HElement {
    const source = this.rawOf(node)
    return el('pre', ROLES.pre, [el('code', [ROLES.codeBlock, ROLES.mathBlock], [text(source)])])
  }

  private rawOf(node: MdNode): string {
    const position = node.position
    if (position) {
      return this.ctx.source.slice(position.start.offset, position.end.offset)
    }
    return String(node.value ?? '')
  }

  private html(node: MdNode): HNode[] {
    const analysis = analyzeRawHtml(String(node.value ?? ''))
    if (analysis.blocked.length > 0) {
      return [el('section', ROLES.p, [text(String(node.value ?? ''))])]
    }
    return [el('section', ROLES.p, this.rawInline(analysis.inline))]
  }

  private rawInline(items: RawInline[]): HNode[] {
    const out: HNode[] = []
    for (const item of items) {
      if (item.kind === 'text') {
        if (item.value) out.push(text(item.value))
      } else if (item.kind === 'br') {
        out.push(el('br', undefined, []))
      } else if (item.kind === 'wrap') {
        out.push(el(item.tag, undefined, this.rawInline(item.children)))
      }
    }
    return out
  }

  private inline(nodes: MdNode[]): HNode[] {
    const out: HNode[] = []
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      // remark keeps an inline HTML start tag, its Markdown children, and the
      // end tag as siblings. Pair safe wrappers before rendering those children.
      if (node.type === 'html') {
        const opening = /^<(sub|sup|u|span)(?:\s[^<>]*?)?\s*>$/i.exec(String(node.value))
        if (opening) {
          const stack = [opening[1].toLowerCase()]
          let end = index + 1
          for (; end < nodes.length; end += 1) {
            if (nodes[end].type !== 'html') continue
            const tag = /^<(\/)?(sub|sup|u|span)(?:\s[^<>]*?)?\s*>$/i.exec(String(nodes[end].value))
            if (!tag) continue
            if (!tag[1]) stack.push(tag[2].toLowerCase())
            else if (stack.at(-1) !== tag[2].toLowerCase()) break
            else stack.pop()
            if (stack.length === 0) break
          }
          if (stack.length === 0 && end < nodes.length) {
            const tagName = opening[1].toLowerCase()
            const analyzed = tagName === 'span' ? analyzeRawHtml(`${node.value}</span>`).inline[0] : undefined
            const inlineStyle = analyzed?.kind === 'wrap' ? analyzed.style : undefined
            if (inlineStyle?.color) this.ctx.inlineColors.add(inlineStyle.color)
            if (inlineStyle?.fontSize) this.ctx.inlineFontSizes.add(parseInt(inlineStyle.fontSize, 10))
            if (tagName === 'span') this.ctx.counters.inlineMarkupChars += String(node.value).length + String(nodes[end].value).length
            out.push(el(tagName, undefined, this.inline(nodes.slice(index + 1, end)),
              inlineStyle ? serializeInlineTextStyle(inlineStyle) || 'display:inline' : tagName === 'span' ? 'display:inline' : undefined))
            index = end
            continue
          }
          out.push(text(String(node.value)))
          continue
        }
        if (/^<\/(sub|sup|u|span)\s*>$/i.test(String(node.value))) {
          out.push(text(String(node.value)))
          continue
        }
      }
      switch (node.type) {
        case 'wxImage': {
          const image = el('img', ROLES.image, [])
          image.properties.src = String(node.url ?? '')
          image.properties.alt = String(node.alt ?? '')
          image.properties.referrerpolicy = 'no-referrer'
          out.push(image)
          break
        }
        case 'wxRawInline':
          out.push(el(String(node.tag), undefined, this.inline(childrenOf(node))))
          break
        case 'text':
          out.push(...sourceTextPieces(this.ctx.source, node).map(piece => ({ ...text(piece.value), source: piece.source })))
          break
        case 'strong':
          out.push(el('strong', undefined, this.inline(childrenOf(node))))
          break
        case 'emphasis':
          out.push(el('em', undefined, this.inline(childrenOf(node))))
          break
        case 'delete':
          out.push(el('del', undefined, this.inline(childrenOf(node))))
          break
        case 'inlineCode':
          out.push(el('code', ROLES.code, [text(String(node.value ?? ''))]))
          break
        case 'break':
          out.push(el('br', undefined, []))
          break
        case 'wxLink': {
          const index = Number((node.data ?? {}).wxLinkIndex ?? 0)
          out.push(el('span', ROLES.link, this.inline(childrenOf(node))))
          out.push(el('span', ROLES.linkRef, [text(`[链接 ${index}]`)]))
          break
        }
        case 'wxLinkText':
          out.push(el('span', ROLES.link, this.inline(childrenOf(node))))
          break
        case 'link':
          out.push(el('span', ROLES.link, this.inline(childrenOf(node))))
          break
        case 'wxFootnoteRef': {
          const index = Number(node.index ?? 0)
          out.push(el('span', ROLES.fnRef, [text(`[注 ${index}]`)]))
          break
        }
        case 'inlineMath': {
          const rawTex = this.rawOf(node)
          if (node.renderedSvg) {
            out.push(el('span', ROLES.mathSvg, [raw(node.renderedSvg as string, rawTex)]))
          } else {
            out.push(el('span', ROLES.math, [text(rawTex)]))
          }
          break
        }
        case 'image':
          out.push(text(textOf(node)))
          break
        case 'html': {
          const analysis = analyzeRawHtml(String(node.value ?? ''))
          if (analysis.blocked.length > 0) {
            out.push(text(String(node.value ?? '')))
          } else {
            out.push(...this.rawInline(analysis.inline))
          }
          break
        }
        default: {
          const children = childrenOf(node)
          if (children.length > 0) out.push(...this.inline(children))
          else if (node.value) out.push(text(String(node.value)))
        }
      }
    }
    return out
  }

  private referenceSections(): HNode[] {
    const out: HNode[] = []
    if (this.ctx.links.length > 0) {
      const items = this.ctx.links
        .slice()
        .sort((left, right) => left.index - right.index)
        .map((link) =>
          el('section', ROLES.footnoteItem, [text(`[链接 ${link.index}] ${link.url}`)]),
        )
      out.push(
        el('section', ROLES.links, [
          el('section', ROLES.sectionTitle, [text(this.ctx.theme.labels.linkSection)]),
          ...items,
        ]),
      )
    }
    if (this.ctx.footnotes.length > 0) {
      const items = this.ctx.footnotes
        .slice()
        .sort((left, right) => left.index - right.index)
        .map((footnote) =>
          el('section', ROLES.footnoteItem, [text(`[注 ${footnote.index}] ${footnote.text}`)]),
        )
      out.push(
        el('section', ROLES.footnotes, [
          el('section', ROLES.sectionTitle, [text(this.ctx.theme.labels.footnoteSection)]),
          ...items,
        ]),
      )
    }
    return out
  }
}

export function buildHast(root: MdNode, ctx: CompileContext): HElement {
  return new HastBuilder(ctx).build(root)
}
