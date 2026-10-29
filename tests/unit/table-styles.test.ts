import { parseFragment, type DefaultTreeAdapterMap } from 'parse5'
import { describe, expect, it } from 'vitest'
import { compile } from '../helpers/compile'

type Node = DefaultTreeAdapterMap['node']
function elements(node: Node, tag: string): DefaultTreeAdapterMap['element'][] {
  return [...('tagName' in node && node.tagName === tag ? [node] : []),
    ...('childNodes' in node ? node.childNodes.flatMap(child => elements(child, tag)) : [])]
}
function styleOf(node: DefaultTreeAdapterMap['element']): Record<string, string> {
  return Object.fromEntries((node.attrs.find(attr => attr.name === 'style')?.value ?? '').split(';').filter(Boolean).map(part => {
    const colon = part.indexOf(':')
    return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()]
  }))
}
const table = '| 项目 | 数值 |\n| --- | ---: |\n| 得分 | 59 |'
const screenshotCss = '<style>\ntable { font-size: 12px !important; line-height: 1.4 !important; }\ntable th, table td { font-size: 12px !important; padding: 6px 8px !important; }\n</style>'

describe('Markdown 表格的 style 样式转换', () => {
  it('将截图中的规则用于所有表格，覆盖紧凑主题样式，预览和复制均保留颜色与加粗', async () => {
    const wide = '| 项目 | Argon | Carbon | Opus | Astra |\n| --- | --- | --- | --- | --- |\n| AA 指数 | 50 | <font color="#1a73e8"><b>59</b></font> | 58 | 57 |'
    for (const themeId of ['ocean-blue', 'jade', 'terracotta']) {
      const result = await compile(`正文段落。\n\n${screenshotCss}\n\n${wide}\n\n${table}`, { themeId })
      expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
      expect(result.diagnostics.filter(item => item.code.startsWith('html.') || item.code === 'table.unsupported-style')).toEqual([])
      for (const html of [result.html, result.previewHtml!]) {
        const root = parseFragment(html)
        expect(elements(root, 'table')).toHaveLength(2)
        for (const element of [...elements(root, 'table'), ...elements(root, 'th'), ...elements(root, 'td')]) {
          expect(styleOf(element)).toMatchObject({ 'font-size': '12px', 'line-height': '1.4' })
        }
        for (const cell of [...elements(root, 'th'), ...elements(root, 'td')]) {
          expect(styleOf(cell)).toMatchObject({ 'padding-top': '6px', 'padding-right': '8px', 'padding-bottom': '6px', 'padding-left': '8px' })
        }
        expect(styleOf(elements(root, 'strong')[0])).toMatchObject({ color: '#1a73e8', 'font-size': '12px' })
        expect(html).not.toMatch(/<style|!important|&lt;style/)
        const paragraph = elements(root, 'section').find(node => node.childNodes.some(child => 'childNodes' in child && child.childNodes.some(text => 'value' in text && text.value === '正文段落。')))!
        expect(styleOf(paragraph)['font-size']).not.toBe('12px')
      }
      expect(result.html).not.toMatch(/data-md2w-|class=/)
      expect(result.plainText).not.toMatch(/style|font-size|important/)
      expect(result.plainText).toContain('AA 指数 | 50 | 59 | 58 | 57')
    }
  })

  it('table 的字号和行高传给单元格，单元格和局部文字的显式设置优先', async () => {
    const result = await compile('<style>table { font-size: 11px !important; line-height: 1.4; } th { font-size: 16px; } td { font-size: 13px; }</style>\n\n' +
      '| 项目 | 数值 |\n| --- | --- |\n| <span style="font-size:18px;color:#ea580c">**局部文字**</span> | 59 |')
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    const root = parseFragment(result.html)
    expect(styleOf(elements(root, 'table')[0])).toMatchObject({ 'font-size': '11px', 'line-height': '1.4' })
    expect(styleOf(elements(root, 'th')[0])).toMatchObject({ 'font-size': '16px', 'line-height': '1.4' })
    expect(styleOf(elements(root, 'td')[0])).toMatchObject({ 'font-size': '13px', 'line-height': '1.4' })
    expect(styleOf(elements(root, 'strong')[0])).toMatchObject({ 'font-size': '18px', color: '#ea580c' })
  })

  it('按 important、选择器优先级和跨 style 块的顺序处理重复规则', async () => {
    const result = await compile('<style>table td { font-size: 15px; padding: 1px 2px 3px 4px !important; } td { font-size: 16px; padding-left: 9px; }</style>\n\n' +
      table + '\n\n<style>td { font-size: 12px !important; font-size: 17px; padding-right: 7px !important; } table td { font-size: 14px !important; }</style>')
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    expect(styleOf(elements(parseFragment(result.html), 'td')[0])).toMatchObject({
      'font-size': '14px', 'padding-top': '1px', 'padding-right': '2px', 'padding-bottom': '3px', 'padding-left': '4px',
    })
    const normal = await compile('<style>table td { font-size: 15px; } td { font-size: 16px; }</style>\n\n' + table)
    expect(styleOf(elements(parseFragment(normal.html), 'td')[0])['font-size']).toBe('15px')
    const later = await compile('<style>td { font-size: 11px; }</style>\n\n' + table + '\n\n<style>td { font-size: 12px; }</style>')
    expect(styleOf(elements(parseFragment(later.html), 'td')[0])['font-size']).toBe('12px')
  })

  it('Markdown 对齐优先于普通 CSS，important 规则可覆盖对齐', async () => {
    const normal = await compile('<style>td { text-align: center; }</style>\n\n' + table)
    const cells = elements(parseFragment(normal.html), 'td')
    expect(styleOf(cells[0])['text-align']).toBe('center')
    expect(styleOf(cells[1])['text-align']).toBe('right')
    const important = await compile('<style>td { text-align: center !important; }</style>\n\n' + table)
    expect(elements(parseFragment(important.html), 'td').map(cell => styleOf(cell)['text-align'])).toEqual(['center', 'center'])
  })

  it('间距缩写展开、边框与背景色通过最终校验', async () => {
    const result = await compile('<style>table { width:100%; margin: 10px 0; border-collapse:collapse; } th, td { padding: 2px 4px 6px; border: 1px solid #123456; background-color:#abcdef; color:#123abc; font-size:11.5px; }</style>\n\n' + table)
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    const root = parseFragment(result.html)
    expect(styleOf(elements(root, 'table')[0])).toMatchObject({ width: '100%', 'margin-top': '10px', 'margin-bottom': '10px', 'margin-left': '0', 'margin-right': '0' })
    for (const cell of [...elements(root, 'th'), ...elements(root, 'td')]) {
      expect(styleOf(cell)).toMatchObject({ 'font-size': '11.5px', 'padding-top': '2px', 'padding-right': '4px', 'padding-bottom': '6px', 'padding-left': '4px', border: '1px solid #123456', 'background-color': '#abcdef', color: '#123abc' })
    }
  })

  it('过滤非表格规则、外部资源和不支持的 CSS，保留同一块中的安全规则并提示', async () => {
    const result = await compile('<style>@import url(https://example.com/a.css); body { color:#ff0000; } .md2w-root { font-size:48px; } table:hover { color:#ff0000; } @media screen { td { font-size:48px; } } td { position:fixed; display:none; background-image:url(https://example.com/a.png); color:var(--evil); font-size:99px; padding:calc(1px + 2px); line-height:1.4; }</style>\n\n' + table)
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    expect(result.diagnostics.some(item => item.code === 'table.unsupported-style' && item.span?.line === 1)).toBe(true)
    expect(result.html).not.toMatch(/example\.com|position:fixed|display:none|url\(|var\(|calc\(|font-size:(?:48|99)px|color:#ff0000|<style/)
    expect(styleOf(elements(parseFragment(result.html), 'td')[0])['line-height']).toBe('1.4')
  })

  it('style 源码不进入正文和内容丢失统计，代码示例中的 style 不参与解析', async () => {
    const short = await compile(screenshotCss + '\n\n' + table)
    expect(short.status, JSON.stringify(short.diagnostics)).toBe('ok')
    expect(short.stats.chars).toBe(short.plainText.length)
    const code = await compile('```html\n' + screenshotCss + '\n```\n\n' + table)
    expect(code.plainText).toContain(screenshotCss)
    expect(elements(parseFragment(code.html), 'td').map(cell => styleOf(cell)['font-size'])).not.toContain('12px')
  })

  it('表格改写为文字时不残留 CSS，也不影响后续正文', async () => {
    const wide = '| A | B | C | D | E |\n| --- | --- | --- | --- | --- |\n| 1 | 2 | 3 | 4 | 5 |'
    const result = await compile(screenshotCss + '\n\n' + wide + '\n\n后续正文。', { options: { tableFallback: 'records' } })
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    expect(result.html).not.toMatch(/<table|<style|font-size:12px/)
    expect(result.plainText).toContain('A：1；B：2；C：3；D：4；E：5')
    expect(result.plainText).toContain('后续正文。')
  })
})
