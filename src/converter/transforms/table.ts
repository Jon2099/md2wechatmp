import type { CompileContext, MdNode } from '../pipeline/types'
import { childrenOf, textOf, transform } from '../pipeline/ast'

const WIDE_COLUMNS = 4
const WIDE_CHARS = 800
const HARD_COLUMNS = 12

function cellText(cell: MdNode): string {
  return textOf(cell).replace(/\s+/g, ' ').trim()
}

function toRecords(node: MdNode): MdNode[] {
  const rows = childrenOf(node)
  const headerRow = rows[0]
  const headers = childrenOf(headerRow).map(cellText)
  const items: MdNode[] = []
  for (const row of rows.slice(1)) {
    const cells = childrenOf(row).map(cellText)
    const pairs: string[] = []
    headers.forEach((header, index) => {
      const value = cells[index]
      if (!value) return
      pairs.push(`${header}：${value}`)
    })
    if (pairs.length === 0) continue
    items.push({
      type: 'listItem',
      spread: false,
      checked: null,
      children: [{ type: 'paragraph', children: [{ type: 'text', value: pairs.join('；') }] }],
    })
  }
  return [
    {
      type: 'list',
      ordered: false,
      spread: false,
      children: items,
      position: node.position,
      data: { wxFromTable: true },
    },
  ]
}

export function applyTablePolicy(root: MdNode, ctx: CompileContext): void {
  const replaced = transform(root, (node) => {
    if (node.type !== 'table') return node
    ctx.counters.tables += 1
    const rows = childrenOf(node)
    const columns = rows.reduce((max, row) => Math.max(max, childrenOf(row).length), 0)
    const chars = textOf(node).length
    const wide = columns >= WIDE_COLUMNS || chars > WIDE_CHARS

    if (columns > HARD_COLUMNS) {
      ctx.diagnostics.push({
        code: 'table.too-many-columns',
        severity: 'warning',
        message: `表格共有 ${columns} 列，在手机屏幕上极易错位换行。`,
        action: '已尽量压缩表格间距与字号输出。',
        advice: `建议拆分为 3-4 列的较小表格，或在【选项】中开启「超宽表格改写为逐行文字」。`,
        review: true,
        span: ctx.spanOf(node),
      })
    } else if (wide) {
      ctx.diagnostics.push({
        code: 'table.wide',
        severity: 'warning',
        message: `此表格较宽（${columns} 列 / 约 ${chars} 字），手机排版易显局促。`,
        action: '已自动采用紧凑排版，优先保证完整可见。',
        advice: '请在右侧预览中核对手机排版效果；若较挤，可在【选项】中选择「超宽表格改写为逐行文字」。',
        review: true,
        span: ctx.spanOf(node),
      })
    }

    if (ctx.options.tableFallback === 'records' && wide) {
      ctx.diagnostics.push({
        code: 'table.fallback-records',
        severity: 'warning',
        message: '已按排版设置将超宽表格改写为逐行文字记录。',
        action: `共转为 ${Math.max(rows.length - 1, 0)} 条记录，避免手机端横向排版异常。`,
        review: true,
        span: ctx.spanOf(node),
      })
      return toRecords(node)
    }

    node.data = { ...(node.data ?? {}), wxCompact: wide }
    return node
  })

  if (replaced) root.children = childrenOf(replaced)
}
