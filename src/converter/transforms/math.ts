import type { CompileContext, MdNode } from '../pipeline/types'
import { walk } from '../pipeline/ast'
import { renderTexToSvg } from './math-svg'

export function flagMath(root: MdNode, ctx: CompileContext): void {
  const isSvgMode = (ctx.options.mathMode ?? 'svg') === 'svg'

  walk(root, (node) => {
    // Callout titles are stored outside children by normalizeBlockquotes.
    for (const title of node.wxTitle ?? []) flagMath(title, ctx)

    if (node.type === 'math') {
      if (isSvgMode) {
        const tex = String(node.value ?? '')
        const res = renderTexToSvg(tex, true)
        if (res.ok && res.svg) {
          node.renderedSvg = res.svg
          return
        }
        ctx.diagnostics.push({
          code: 'math.error',
          severity: 'warning',
          message: `LaTeX 公式解析失败（${res.error ?? '语法错误'}），已临时输出公式源码。`,
          action: '以等宽代码格式输出，避免排版错误中断。',
          advice: '请检查该公式的书写符号是否完整配对。',
          review: true,
          span: ctx.spanOf(node),
        })
        return
      }

      ctx.diagnostics.push({
        code: 'math.block-review',
        severity: 'warning',
        message: '当前设置为保留公式源码，块级公式按 LaTeX 原文输出。',
        action: '以等宽代码块排版展示。',
        advice: '如需生成自适应主题的超清矢量公式，请在【选项】中开启「矢量 SVG（推荐）」。',
        review: true,
        span: ctx.spanOf(node),
      })
    }

    if (node.type === 'inlineMath') {
      if (isSvgMode) {
        const tex = String(node.value ?? '')
        const res = renderTexToSvg(tex, false)
        if (res.ok && res.svg) {
          node.renderedSvg = res.svg
          return
        }
        ctx.diagnostics.push({
          code: 'math.error',
          severity: 'warning',
          message: `行内 LaTeX 公式解析失败（${res.error ?? '语法错误'}），已临时输出公式源码。`,
          action: '以普通文本格式输出，避免排版错误中断。',
          advice: '请检查该行内公式的符号闭合是否正确。',
          review: true,
          span: ctx.spanOf(node),
        })
        return
      }

      ctx.diagnostics.push({
        code: 'math.inline',
        severity: 'warning',
        message: '当前设置为保留公式源码，行内公式保留了 $ 定界符原文。',
        action: '按普通文本直接输出。',
        advice: '如需将公式渲染为超清矢量图形，请在【选项】中开启「矢量 SVG（推荐）」。',
        review: true,
        span: ctx.spanOf(node),
      })
    }
  })
}
