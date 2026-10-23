import { describe, expect, it } from 'vitest'
import { compile } from '../helpers/compile'
import { sanitizeFragment } from '@converter/sanitize/sanitize'
import { getTheme } from '@themes/builtins/index'

describe('公式与美元金额', () => {
  it('引用中的美元金额不吞掉粗体、换行与列表', async () => {
    const snapshot = await compile([
      '> **8 卡整机基础产出（按官方 $38/小时 谷价计算）**  ',
      '> · 单卡每小时产出：$38 × 7.20 = **273.60 元人民币**  ',
      '> · 单卡单日产出：273.60 × 24 = **6,566.40 元人民币**',
    ].join('\n'))
    expect(snapshot.status).toBe('ok')
    expect(snapshot.html).not.toContain('<svg')
    expect(snapshot.html).toContain('8 卡整机基础产出（按官方 $38/小时 谷价计算）')
    expect(snapshot.html).toContain('单卡每小时产出：$38 × 7.20 = ')
    expect(snapshot.html.match(/<li /g)).toHaveLength(2)
    expect(snapshot.html).not.toContain('**')
  })

  it.each([
    '价格为 $5 和 $10。',
    '价格为 **$38/小时** 和 **$76/小时**。',
    '价格为 US$38、US$76。',
    '价格从 $5涨到$10。',
  ])('保留普通金额：%s', async (markdown) => {
    const snapshot = await compile(markdown)
    expect(snapshot.html).not.toContain('<svg')
    expect(snapshot.plainText).toBe(markdown.replaceAll('**', ''))
  })

  it('金额与真正的行内公式可以共存', async () => {
    const snapshot = await compile('预算 $5，公式 $x^2 + y^2 = z^2$，费用 $10，常量 $2$。')
    expect(snapshot.html.match(/<svg/g)).toHaveLength(2)
    expect(snapshot.html).toContain('预算 $5，公式 ')
    expect(snapshot.html).toContain('费用 $10，常量 ')
    expect(snapshot.plainText).toContain('$x^2 + y^2 = z^2$')
  })

  it('独占一段的双美元公式按块级显示', async () => {
    const snapshot = await compile('$$E = mc^2$$')
    expect(snapshot.html).toMatch(/<section[^>]*text-align:center[^>]*><svg/)
    expect(snapshot.plainText).toBe('$$E = mc^2$$')
  })

  it('中文公式在清洗后保留字形和位置', async () => {
    const snapshot = await compile(String.raw`$$\text{回本天数} = \frac{15,000,000 \text{ 元}}{52,531.20 \text{ 元/天}} \approx \mathbf{285.54 \text{ 天（约 9.4 个月）}}$$`)
    expect(snapshot.status).toBe('ok')
    expect(snapshot.html).toMatch(/<text[^>]*transform="scale\(1,-1\)"[^>]*font-size=/)
    for (const character of '回本天数元约个月') expect(snapshot.html).toContain(`>${character}</text>`)
    expect(snapshot.diagnostics.filter((item) => item.severity !== 'info')).toEqual([])
    expect(snapshot.html).not.toContain('class=')
  })

  it('保留多个数字和运算符各自的位置，避免字形重叠', async () => {
    const snapshot = await compile('$38 \\times 7.20 = 273.60$')
    expect(snapshot.status).toBe('ok')
    expect(snapshot.html).toMatch(/<path[^>]*data-c="38"[^>]*transform="translate\(500,0\)"/)
    expect(snapshot.html).toMatch(/<path[^>]*data-c="32"[^>]*transform="translate\(/)
  })

  it('提示块标题和正文内的公式都能转换', async () => {
    const snapshot = await compile('> **质能公式 $E=mc^2$**  \n> 正文公式 $x^2$。')
    expect(snapshot.html.match(/<svg/g)).toHaveLength(2)
    expect(snapshot.diagnostics.some((item) => item.code === 'callout.converted')).toBe(true)
    expect(snapshot.plainText).toContain('$E=mc^2$')
  })

  it('句子中的双美元公式保持行内，代码块不参与转换', async () => {
    const snapshot = await compile('公式 $$x^2$$ 在句中。\n\n```tex\n$x^2$\n$$x^2$$\n```')
    expect(snapshot.html.match(/<svg/g)).toHaveLength(1)
    expect(snapshot.html).toMatch(/<span[^>]*><svg/)
    expect(snapshot.plainText).toContain('```\n$x^2$\n$$x^2$$\n```')
  })

  it('允许 SVG 静态文本，同时继续移除脚本、事件与外部引用', () => {
    const result = sanitizeFragment('<section><svg class="unsafe" onload="alert(1)"><script>alert(1)</script><text transform="scale(1,-1)" font-size="884px" onclick="alert(1)">中文</text><use href="https://example.com/glyph.svg#x"></use></svg></section>', getTheme('ocean-blue'))
    expect(result.html).toContain('<text transform="scale(1,-1)" font-size="884px">中文</text>')
    expect(result.html).not.toMatch(/script|onload|onclick|class=|href=|<use/)
  })

  it('代码、转义美元和原始模式保留源码', async () => {
    const markdown = '`$x$` 和 \\$5；公式 $x^2$。'
    const snapshot = await compile(markdown, { options: { mathMode: 'raw' } })
    expect(snapshot.html).not.toContain('<svg')
    expect(snapshot.plainText).toContain('`$x$` 和 $5；公式 $x^2$。')
    expect(snapshot.diagnostics.filter((item) => item.code === 'math.inline')).toHaveLength(1)
  })
})
