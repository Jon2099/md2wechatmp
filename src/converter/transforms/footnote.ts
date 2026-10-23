import type { FootnoteRecord } from '@shared/models/snapshot'
import type { CompileContext, MdNode } from '../pipeline/types'
import { childrenOf, textOf, transform, walk } from '../pipeline/ast'

function blockText(node: MdNode): string {
  return childrenOf(node)
    .map((child) => (child.type === 'paragraph' ? textOf(child) : textOf(child)))
    .filter((text) => text.trim().length > 0)
    .join('\n')
}

export function resolveFootnotes(root: MdNode, ctx: CompileContext): void {
  const definitions = new Map<string, string>()
  walk(root, (node) => {
    if (node.type === 'footnoteDefinition') {
      definitions.set(String(node.identifier ?? ''), blockText(node))
    }
  })

  const order = new Map<string, number>()
  const records: FootnoteRecord[] = []

  const replaced = transform(root, (node) => {
    if (node.type === 'footnoteDefinition') return null

    if (node.type === 'footnoteReference') {
      const identifier = String(node.identifier ?? '')
      let index = order.get(identifier)
      if (index === undefined) {
        index = order.size + 1
        order.set(identifier, index)
        const text = definitions.get(identifier)
        if (text === undefined) {
          ctx.diagnostics.push({
            code: 'footnote.missing',
            severity: 'warning',
            message: `正文中的脚注「[^${String(node.label ?? identifier)}]」缺少对应解释说明。`,
            action: '正文已保留该编号角标，文末暂未生成释义。',
            advice: `请在文中补充「[^${String(node.label ?? identifier)}]: 说明内容」，或删除该角标。`,
            review: true,
            span: ctx.spanOf(node),
          })
        }
        records.push({ index, label: String(node.label ?? identifier), text: text ?? '' })
      }
      return { type: 'wxFootnoteRef', index, position: node.position }
    }

    return node
  })

  if (replaced) root.children = childrenOf(replaced)

  for (const identifier of definitions.keys()) {
    if (!order.has(identifier)) {
      ctx.diagnostics.push({
        code: 'footnote.unreferenced',
        severity: 'warning',
        message: `文末定义了脚注「[^${identifier}]」，但在正文中并未被引用。`,
        action: '仍将在文末显示该条释义，避免丢失内容。',
        advice: '如无需该条脚注，可在源文档中直接删除。',
        review: true,
        span: undefined,
      })
      records.push({
        index: records.length + 1,
        label: identifier,
        text: definitions.get(identifier) ?? '',
      })
    }
  }

  ctx.footnotes = records.sort((left, right) => left.index - right.index)
}
