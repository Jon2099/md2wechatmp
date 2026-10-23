import type { CompileContext, MdNode } from '../pipeline/types'
import { childrenOf, textOf, sliceSource } from '../pipeline/ast'

/** 文章标题只取第一个顶层一级标题；章节、引用和代码中的标题不受影响。 */
export function applyTitlePolicy(root: MdNode, ctx: CompileContext): number {
  const nodes = childrenOf(root)
  const index = nodes.findIndex(node => node.type === 'heading' && node.depth === 1)
  if (index < 0) return 0
  const title = nodes[index]
  if (!ctx.meta.title) ctx.meta.title = textOf(title)
  if (ctx.options.includeTitle !== false) return 0

  // 在链接、媒体等转换前移除，避免为隐藏标题生成图片、编号或占位符。
  root.children = nodes.filter((_, at) => at !== index)
  return sliceSource(ctx.source, title).length
}
