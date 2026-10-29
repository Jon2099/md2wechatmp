import { parseFragment } from 'parse5'
import { expect, it } from 'vitest'
import { compile } from '../helpers/compile'

function textOf(node: any): string {
  return node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(textOf).join('')
}
function elements(node: any, tag: string): any[] {
  return [...(node.tagName === tag ? [node] : []), ...(node.childNodes ?? []).flatMap((child: any) => elements(child, tag))]
}

it('化学下标和数学上标真正包住数字', async () => {
  const result = await compile('H<sub>2</sub>O 和 x<sup>2</sup>。')
  const root = parseFragment(result.html)
  expect(elements(root, 'sub').map(textOf)).toEqual(['2'])
  expect(elements(root, 'sup').map(textOf)).toEqual(['2'])
  expect(result.plainText).toBe('H2O 和 x2。')
})

it('支持嵌套和内部 Markdown，移除标签属性中的事件', async () => {
  const result = await compile('x<sup onclick="alert(1)">**2**<sub>i</sub></sup> 和 <u>下划线</u>。')
  const root = parseFragment(result.html)
  expect(elements(root, 'sup').map(textOf)).toEqual(['2i'])
  expect(elements(root, 'sub').map(textOf)).toEqual(['i'])
  expect(elements(root, 'u').map(textOf)).toEqual(['下划线'])
  expect(elements(elements(root, 'sup')[0], 'strong').map(textOf)).toEqual(['2'])
  expect(result.html).not.toContain('onclick')
})

it('未闭合或错配标签保留文字，代码不参与标签配对', async () => {
  const malformed = await compile('x<sup>2</sub>。')
  expect(malformed.plainText).toContain('x<sup>2</sub>。')
  expect(elements(parseFragment(malformed.html), 'sup')).toHaveLength(0)
  const code = await compile('`<sup>2</sup>`')
  expect(elements(parseFragment(code.html), 'sup')).toHaveLength(0)
  expect(code.plainText).toBe('`<sup>2</sup>`')
})

it('表格中的 font 颜色和 b 加粗转换为带颜色的标准标签，预览和复制结果一致', async () => {
  const source = [
    '| 关键评测项目 | Carbon | Opus 5.5 | GPT-6 Astra |',
    '| --- | --- | --- | --- |',
    '| AA 综合指数 v5 | <font color="#1a73e8"><b>59</b></font> | 58 | 57 |',
    '| OSWorld | 81.5% | <font color="#ea580c"><b>87.2%</b></font> | 76.5% |',
    '| HLE-Diamond | 69.0% | 67.9% | <font color="#16a34a"><b>78.0%</b></font> |',
    '',
    '*注：<font color="#1a73e8">■ 蓝色</font>为 Carbon。*',
  ].join('\n')
  for (const themeId of ['ocean-blue', 'jade', 'terracotta']) {
    const result = await compile(source, { themeId })
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    expect(result.diagnostics.some(item => item.code === 'html.unsupported-tag')).toBe(false)
    expect(result.plainText).toContain('59 | 58 | 57')
    expect(result.plainText).toContain('注：■ 蓝色为 Carbon。')
    for (const html of [result.html, result.previewHtml!]) {
      const root = parseFragment(html)
      for (const [value, color] of [['59', '#1a73e8'], ['87.2%', '#ea580c'], ['78.0%', '#16a34a']]) {
        const strong = elements(root, 'strong').find(node => textOf(node) === value)
        expect(strong, value).toBeDefined()
        expect(strong.attrs.find((attr: any) => attr.name === 'style')?.value).toContain(`color:${color}`)
      }
      expect(elements(root, 'font')).toHaveLength(0)
      expect(textOf(root)).not.toMatch(/<\/?(?:font|b)>|<font /)
    }
  }
})

it('颜色可包裹 HTML 和 Markdown 加粗，内层显式颜色优先且可继续在预览中修改', async () => {
  const result = await compile('<FONT COLOR="#1A73E8"><b>蓝色</b> **蓝粗体** <strong>蓝强调</strong> <font color="#ea580c"><b>橙色</b></font></FONT>')
  expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
  const root = parseFragment(result.html)
  for (const strong of elements(root, 'strong')) {
    const color = textOf(strong) === '橙色' ? '#ea580c' : '#1a73e8'
    expect(strong.attrs.find((attr: any) => attr.name === 'style')?.value).toContain(`color:${color}`)
  }
  const preview = parseFragment(result.previewHtml!)
  expect(elements(preview, 'span').some(node => textOf(node) === '蓝色' && node.attrs.some((attr: any) => attr.name === 'data-md2w-source'))).toBe(true)
})

it('font 属性按安全行内样式处理，拒绝属性中的 CSS 注入和事件', async () => {
  const result = await compile('正文 <font color="#1A73E8" face="evil" size="7" onclick="alert(1)" style="position:fixed;background:url(https://example.com)"><b onmouseover="alert(2)">蓝色</b></font>。')
  expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
  expect(result.html).toContain('color:#1a73e8')
  expect(result.html).not.toMatch(/onclick|onmouseover|evil|position:fixed|url\(|https:\/\/example.com/)
  const invalid = await compile('正文 <font color="#1a73e8;display:none"><b>文字</b></font>。')
  expect(invalid.status, JSON.stringify(invalid.diagnostics)).toBe('ok')
  expect(invalid.html).not.toContain('color:#1a73e8')
  expect(invalid.html).not.toContain('display:none')
  expect(invalid.plainText).toBe('正文 文字。')
})

it('错配和未闭合的 font/b 保留原文，代码中的颜色标记不参与转换', async () => {
  for (const source of ['文字 <font color="#1a73e8"><b>59</font></b>。', '文字 <font color="#1a73e8">59。']) {
    const result = await compile(source)
    expect(result.plainText).toBe(source)
    expect(result.html).not.toContain('color:#1a73e8')
  }
  const source = '<font color="#1a73e8"><b>59</b></font>'
  const code = await compile('`' + source + '`\n\n```html\n' + source + '\n```')
  expect(elements(parseFragment(code.html), 'strong')).toHaveLength(0)
  expect(code.html).not.toContain('color:#1a73e8')
  expect(code.plainText).toContain(source)
})
