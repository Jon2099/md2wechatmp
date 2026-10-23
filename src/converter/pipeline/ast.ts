import type { SourceSpan } from '@shared/models/diagnostic'
import type { MdNode } from './types'

export function childrenOf(node: MdNode | undefined): MdNode[] {
  return Array.isArray(node?.children) ? (node.children as MdNode[]) : []
}

export function isParent(node: MdNode | undefined): boolean {
  return Array.isArray(node?.children)
}

export function walk(node: MdNode, visit: (node: MdNode, parent: MdNode | null, index: number) => void): void {
  const stack: Array<{ node: MdNode; parent: MdNode | null; index: number }> = [
    { node, parent: null, index: -1 },
  ]
  while (stack.length > 0) {
    const current = stack.pop() as { node: MdNode; parent: MdNode | null; index: number }
    visit(current.node, current.parent, current.index)
    const children = childrenOf(current.node)
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], parent: current.node, index })
    }
  }
}

type TransformFn = (node: MdNode) => MdNode | MdNode[] | null

function transformNode(node: MdNode, fn: TransformFn): MdNode | MdNode[] | null {
  const children = childrenOf(node)
  if (children.length > 0) {
    const next: MdNode[] = []
    for (const child of children) {
      const replaced = transformNode(child, fn)
      if (replaced === null) continue
      if (Array.isArray(replaced)) next.push(...replaced)
      else next.push(replaced)
    }
    node.children = next
  }
  return fn(node)
}

/** 自底向上替换节点：返回 null 表示删除，返回数组表示在父级展开为多个节点 */
export function transform(node: MdNode, fn: TransformFn): MdNode | null {
  const result = transformNode(node, fn)
  // 根节点不允许展开成多个节点；调用方对 root 只会返回单节点或 null。
  return Array.isArray(result) ? (result[0] ?? null) : result
}

export function textOf(node: MdNode | undefined): string {
  if (!node) return ''
  if (typeof node.value === 'string' && node.type !== 'root') return node.value
  return childrenOf(node)
    .map((child) => textOf(child))
    .join('')
}

export function spanFromPosition(position: MdNode['position']): SourceSpan | undefined {
  if (!position) return undefined
  return {
    line: position.start.line,
    column: position.start.column,
    endLine: position.end.line,
    endColumn: position.end.column,
    offset: position.start.offset,
  }
}

export function sliceSource(source: string, node: MdNode): string {
  if (!node.position) return textOf(node)
  return source.slice(node.position.start.offset, node.position.end.offset)
}

export function findFirst(node: MdNode, type: string): MdNode | undefined {
  if (node.type === type) return node
  for (const child of childrenOf(node)) {
    const found = findFirst(child, type)
    if (found) return found
  }
  return undefined
}
