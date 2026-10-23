import type { CompileContext, ConverterDeps, MdNode } from '../pipeline/types'
import { walk } from '../pipeline/ast'
import { DIAGRAM_LANGS, LANG_ALIASES } from '../highlight/languages'

const LONG_LINE = 120

export async function highlightCodeBlocks(
  root: MdNode,
  ctx: CompileContext,
  deps: ConverterDeps,
): Promise<void> {
  const codeNodes: MdNode[] = []
  walk(root, (node) => {
    if (node.type === 'code') codeNodes.push(node)
  })
  ctx.counters.codeBlocks = codeNodes.length

  for (const node of codeNodes) {
    ctx.checkAbort()
    const rawLang = String(node.lang ?? '').trim().toLowerCase()
    const data = { ...(node.data ?? {}) }
    node.data = data

    const value = String(node.value ?? '')
    const hasLongLine = value.split(/\r?\n/).some((line) => line.length > LONG_LINE)
    if (hasLongLine) {
      ctx.diagnostics.push({
        code: 'code.long-line',
        severity: 'info',
        message: '代码块中存在较长的单行代码。',
        action: '长代码行已自动折行显示，防止破坏整体版面。',
        advice: '若更习惯水平滑动查看，可在【选项】中将代码换行改为「横向滚动」。',
        review: false,
        span: ctx.spanOf(node),
      })
    }

    if (!rawLang) continue

    if (DIAGRAM_LANGS.has(rawLang)) {
      data.wxDiagram = true
      ctx.diagnostics.push({
        code: 'diagram.source-block',
        severity: 'warning',
        message: '微信公众平台不支持动态渲染图表代码（Mermaid / PlantUML）。',
        action: '已保留图表源码作为等宽代码块展示。',
        advice: '建议先在本地渲染导出为图片，再将图片插入文章中。',
        review: true,
        span: ctx.spanOf(node),
      })
      continue
    }

    if (!LANG_ALIASES[rawLang]) {
      ctx.diagnostics.push({
        code: 'code.unknown-language',
        severity: 'info',
        message: `未找到「${rawLang}」的代码语法高亮规则，已按等宽纯文本输出。`,
        action: '完整保留代码缩进与全部文字格式。',
        review: false,
        span: ctx.spanOf(node),
      })
      continue
    }

    if (!ctx.options.highlight) continue

    const tokens = await deps.highlighter.highlight(value, rawLang, ctx.theme.shiki.theme)
    if (!tokens) {
      ctx.diagnostics.push({
        code: 'code.highlight-fallback',
        severity: 'warning',
        message: '此代码块语法高亮处理失败，已自动降级为等宽纯文本。',
        action: '保留全部代码文字，确保整篇转换正常完成。',
        review: false,
        span: ctx.spanOf(node),
      })
      continue
    }
    data.wxTokens = tokens
  }
}
