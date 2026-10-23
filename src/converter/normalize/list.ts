import type { MdNode } from '../pipeline/types'
import { childrenOf } from '../pipeline/ast'

export interface ListFlavor {
  ordered: boolean
  start: number
  depth: number
  checked: boolean | null
}

export function listFlavor(node: MdNode, depth = 1): ListFlavor {
  const ordered = Boolean(node.ordered)
  const start = ordered && typeof node.start === 'number' ? node.start : 1
  const firstItem = childrenOf(node)[0]
  const checked = typeof firstItem?.checked === 'boolean' ? firstItem.checked : null
  return { ordered, start, depth, checked }
}

/** 规范化列表树：补齐 ordered 标记、限制嵌套层级、标记静态序号来源 */
export function normalizeListTree(root: MdNode): void {
  const visit = (node: MdNode) => {
    if (node.type === 'list') {
      node.ordered = Boolean(node.ordered)
      if (node.ordered && typeof node.start !== 'number') node.start = 1
    }
    if (node.type === 'listItem') {
      node.checked = typeof node.checked === 'boolean' ? node.checked : null
    }
    childrenOf(node).forEach(visit)
  }
  visit(root)
}
