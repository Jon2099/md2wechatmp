import type { CompileContext, MdNode } from '../pipeline/types'
import { childrenOf, transform, walk } from '../pipeline/ast'
import { normalizeBlockquotes } from './blockquote'
import { normalizeListTree } from './list'

interface DefinitionRecord {
  url: string
  title: string | null
}

export function normalizeDocument(root: MdNode, ctx: CompileContext): void {
  const definitions = new Map<string, DefinitionRecord>()
  walk(root, (node) => {
    if (node.type === 'definition' && typeof node.identifier === 'string') {
      definitions.set(node.identifier.toLowerCase(), {
        url: String(node.url ?? ''),
        title: typeof node.title === 'string' ? node.title : null,
      })
    }
  })

  const resolved = transform(root, (node) => {
    if (node.type === 'definition') return null

    if (node.type === 'linkReference') {
      const def = definitions.get(String(node.identifier ?? '').toLowerCase())
      if (!def) {
        ctx.diagnostics.push({
          code: 'link.missing-definition',
          severity: 'warning',
          message: `参考式链接「[${String(node.label ?? node.identifier ?? '')}]」在文档中缺少对应的 URL 定义。`,
          action: '正文已保留链接文字，未生成文末跳转编号。',
          advice: `请在文末补上「[${String(node.label ?? node.identifier ?? '')}]: 目标网址」，或直接改用行内链接语法。`,
          review: true,
          span: ctx.spanOf(node),
        })
        return { type: 'text', value: childrenOf(node).map((child) => child.value ?? '').join('') }
      }
      return {
        type: 'link',
        url: def.url,
        title: def.title,
        children: childrenOf(node),
        position: node.position,
        data: { wxFromReference: true },
      }
    }

    if (node.type === 'imageReference') {
      const def = definitions.get(String(node.identifier ?? '').toLowerCase())
      if (!def) {
        ctx.diagnostics.push({
          code: 'image.missing-definition',
          severity: 'warning',
          message: `参考式图片「![${String(node.label ?? node.identifier ?? '')}]」在文档中缺少对应的图片地址定义。`,
          action: '保留了原始提示文字，未生成占位符。',
          advice: `请在文末补上「[${String(node.label ?? node.identifier ?? '')}]: 图片路径」，或直接使用常规图片语法。`,
          review: true,
          span: ctx.spanOf(node),
        })
        return { type: 'text', value: `![${String(node.alt ?? '')}]` }
      }
      return {
        type: 'image',
        url: def.url,
        title: def.title,
        alt: node.alt ?? null,
        position: node.position,
      }
    }

    return node
  })

  if (resolved) {
    root.children = childrenOf(resolved)
  }

  const unresolvedRef = /(!?)\[([^\]]+)\]\[([^\]]*)\]/g
  walk(root, (node) => {
    if (node.type !== 'text' || typeof node.value !== 'string') return
    if (!unresolvedRef.test(node.value)) return
    unresolvedRef.lastIndex = 0
    const match = unresolvedRef.exec(node.value)
    unresolvedRef.lastIndex = 0
    if (!match) return
    ctx.diagnostics.push({
      code: 'markdown.unresolved-reference',
      severity: 'warning',
      message: `未找到「[${match[2]}]」的对应定义，已按原文保留完整文字。`,
      action: '保留全部可见文字，避免排版截断。',
      advice: `如需作为有效${match[1] === '!' ? '图片' : '链接'}，请在文档中补充对应定义行，或改用标准行内语法。`,
      review: true,
      span: ctx.spanOf(node),
    })
  })

  normalizeBlockquotes(root, ctx)
  normalizeListTree(root)
}
