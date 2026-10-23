import type { CompileContext, MdNode } from '../pipeline/types'
import { childrenOf, walk } from '../pipeline/ast'

export function flagTaskLists(root: MdNode, ctx: CompileContext): void {
  walk(root, (node) => {
    if (node.type !== 'list') return
    const items = childrenOf(node)
    const hasChecked = items.some((item) => typeof item.checked === 'boolean')
    if (!hasChecked) return
    node.data = { ...(node.data ?? {}), wxTaskList: true }
    ctx.diagnostics.push({
      code: 'tasklist.static',
      severity: 'info',
      message: '微信公众平台不支持交互式复选框，待办清单已转为整齐的「☑ / ☐」排版。',
      action: '保留清单选中状态与对齐样式。',
      review: false,
      span: ctx.spanOf(node),
    })
  })
}
