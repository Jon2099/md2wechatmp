import { expect, it } from 'vitest'
import { compile } from '../helpers/compile'
import { sanitizeFragment } from '@converter/sanitize/sanitize'
import { getTheme } from '@themes/builtins/index'

it.each([
  'url(https://example.com/paint.svg#x)', 'url(#local)', 'URL(//example.com/x)',
  'url(data:image/svg+xml,x)', 'var(--paint)', String.raw`u\72l(https://example.com/x)`,
])('拒绝 SVG fill/stroke 资源引用：%s', (paint) => {
  const result = sanitizeFragment(`<section><svg><g fill="${paint}" stroke="${paint}"><path d="M0 0L1 1"></path></g></svg></section>`, getTheme('ocean-blue'))
  expect(result.html).not.toContain('fill=')
  expect(result.html).not.toContain('stroke=')
  expect(result.html).toContain('<path')
})

it.each(['currentColor', 'none', 'red', '#123456', 'rgb(12, 34, 56)'])('保留合法 SVG 颜色：%s', (paint) => {
  const result = sanitizeFragment(`<svg><g fill="${paint}" stroke="${paint}"></g></svg>`, getTheme('ocean-blue'))
  expect(result.html).toContain(`fill="${paint}"`)
  expect(result.html).toContain(`stroke="${paint}"`)
})

it('恶意 LaTeX 经过整条管线后不再保留任何外链绘制属性', async () => {
  const snapshot = await compile(String.raw`$\color{url(http://127.0.0.1:41397/paint.svg#x)}{x}$`)
  expect(snapshot.status).toBe('ok')
  expect(snapshot.html).toContain('<svg')
  expect(snapshot.html).not.toContain('url(')
  expect(snapshot.html).not.toContain('41397')
})
