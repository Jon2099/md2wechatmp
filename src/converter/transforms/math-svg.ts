import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

const mathDocument = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'none' }),
})

export interface MathRenderResult {
  ok: boolean
  svg?: string
  error?: string
}

export function renderTexToSvg(tex: string, display: boolean): MathRenderResult {
  const trimmed = tex.trim()
  if (!trimmed) {
    return { ok: false, error: '公式内容为空' }
  }
  try {
    const node = mathDocument.convert(trimmed, { display })
    const svgHtml = adaptor.innerHTML(node) as string
    if (!svgHtml || !svgHtml.startsWith('<svg')) {
      return { ok: false, error: '未能生成有效矢量图形' }
    }
    if (svgHtml.includes('data-mml-node="merror"')) {
      return { ok: false, error: '公式语法错误' }
    }
    return { ok: true, svg: svgHtml }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
