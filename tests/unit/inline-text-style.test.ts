import { parseFragment, type DefaultTreeAdapterMap } from 'parse5'
import { describe, expect, it } from 'vitest'
import {
  applyInlineTextStyle,
  INLINE_FONT_SIZE_PRESETS,
  parseInlineTextStyle,
  serializeInlineTextStyle,
} from '@shared/inline-text-style'
import { sourceTextMapping } from '@converter/serialize/source-mapping'
import { parseMarkdown } from '@converter/parse/markdown'
import { compile } from '../helpers/compile'

type Node = DefaultTreeAdapterMap['node']
function elements(node: Node, tag: string): DefaultTreeAdapterMap['element'][] {
  return [...('tagName' in node && node.tagName === tag ? [node] : []),
    ...('childNodes' in node ? node.childNodes.flatMap(child => elements(child, tag)) : [])]
}
function textOf(node: Node): string {
  return 'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(textOf).join('') : ''
}
function selected(source: string, value: string, at = 0) {
  const start = source.indexOf(value, at)
  return { start, end: start + value.length, text: value }
}

describe('预览局部文字样式', () => {
  it('用源文位置修改重复文字的指定一次，保持加粗、链接和其他文字', async () => {
    const source = '相同文字和 **相同文字**，以及 [链接文字](https://example.com)。'
    const ranges = [selected(source, '相同文字', 1), selected(source, '链接文字')]
    const formatted = applyInlineTextStyle(source, ranges, { color: '#e53935', fontSize: '18px' })
    expect(formatted.startsWith('相同文字和 **<span')).toBe(true)
    expect(formatted).toContain('</span>**，以及 [<span')
    expect(formatted).toContain('](https://example.com)')
    for (const themeId of ['ocean-blue', 'jade', 'terracotta']) {
      const result = await compile(formatted, { themeId })
      expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
      expect(result.html).toContain('color:#e53935')
      expect(result.html).toContain('font-size:18px')
      expect(result.html).toContain('color:#2d2d2d')
      const strong = elements(parseFragment(result.html), 'strong')[0]
      expect(textOf(strong)).toBe('相同文字')
      expect(elements(strong, 'span').some(node => node.attrs.some(attr => attr.name === 'style' && attr.value.includes('color:#e53935')))).toBe(true)
      expect(result.html).not.toContain('data-md2w-')
      expect(result.html).not.toContain('selection-toolbar')
      expect(result.previewHtml).toContain('data-md2w-source')
    }
  })

  it('分段设置样式后保存再转换，文本和格式不丢失；可以在已有样式内继续改字号', async () => {
    const source = '第一段文字。\n\n第二段 **重点文字**。'
    const formatted = applyInlineTextStyle(source, [selected(source, '段文字'), selected(source, '第二段 '), selected(source, '重点文字')], { color: '#123456' })
    expect(formatted).toContain('。\n\n<span')
    const second = applyInlineTextStyle(formatted, [selected(formatted, '重点文字')], { fontSize: '24px' })
    const result = await compile(second)
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    expect(result.html).toContain('color:#123456')
    expect(result.html).toContain('font-size:24px')
    expect(result.plainText).toContain('重点文字')
    expect(textOf(parseFragment(result.html))).toBe('第一段文字。第二段 重点文字。')
  })

  it('转义、实体和 emoji 的位置映射准确，不能选取半个已解码字符', async () => {
    const source = 'A &amp; B \\* 😀 &#x1F600;'
    const node = parseMarkdown(source).children![0].children![0]
    const mapping = sourceTextMapping(source, node)!
    expect(mapping.offsets).toBeDefined()
    const value = node.value!
    const amp = value.indexOf('&')
    expect(source.slice(mapping.offsets![amp]!, mapping.offsets![amp + 1]!)).toBe('&amp;')
    const star = value.indexOf('*')
    expect(source.slice(mapping.offsets![star]!, mapping.offsets![star + 1]!)).toBe('\\*')
    const emoji = value.lastIndexOf('😀')
    expect(mapping.offsets![emoji + 1]).toBeNull()
    expect(source.slice(mapping.offsets![emoji]!, mapping.offsets![emoji + 2]!)).toBe('&#x1F600;')
    const result = await compile(source)
    expect(result.previewHtml).toContain('&quot;offsets&quot;')
    expect(result.html).not.toContain('data-md2w-')
  })

  it('代码、公式、自动链接编号不生成可编辑的源文标记', async () => {
    const result = await compile('普通文字 `代码` 与 $a+b$，以及 [网站](https://example.com)。\n\n```js\nconst n = 1\n```')
    const fragment = parseFragment(result.previewHtml!)
    for (const code of elements(fragment, 'code')) {
      expect(elements(code, 'span').flatMap(node => node.attrs).some(attr => attr.name === 'data-md2w-source')).toBe(false)
    }
    const markers = elements(fragment, 'span').filter(node => node.attrs.some(attr => attr.name === 'data-md2w-source')).map(textOf)
    expect(markers).not.toContain('[链接 1]')
    expect(markers).not.toContain('a+b')
  })

  it('引用和列表的换行前缀不进入可编辑选区', async () => {
    const source = '> 引用第一行\n> 引用第二行\n\n- 列表第一行\n  列表第二行'
    const result = await compile(source)
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    const markers = elements(parseFragment(result.previewHtml!), 'span').filter(node => node.attrs.some(attr => attr.name === 'data-md2w-source'))
    for (const value of ['引用第一行', '引用第二行', '列表第一行', '列表第二行']) {
      const marker = markers.find(node => textOf(node) === value)!
      expect(marker, value).toBeDefined()
      const mapping = JSON.parse(marker.attrs.find(attr => attr.name === 'data-md2w-source')!.value)
      expect(source.slice(mapping.start, mapping.end)).toBe(value)
    }
  })

  it('选区失效、越界或重叠时拒绝修改；字体和任意 CSS 不被保存', () => {
    const source = '相同文字'
    expect(() => applyInlineTextStyle(source, [{ start: 0, end: 4, text: '已变化了' }], { color: '#e53935' })).toThrow('选区已失效')
    expect(() => applyInlineTextStyle(source, [{ start: -1, end: 4, text: source }], { color: '#e53935' })).toThrow()
    expect(() => applyInlineTextStyle(source, [selected(source, '相同'), selected(source, '同文')], { color: '#e53935' })).toThrow()
    expect(applyInlineTextStyle(source, [selected(source, '相同')], { color: 'red;display:none', fontSize: '100px' })).toBe(source)
    expect(parseInlineTextStyle('color:#E53935;position:fixed;display:none;font-family:evil')).toEqual({ color: '#e53935' })
  })

  it('手写行内样式仅保留颜色和字号，移除事件、外链和其他声明', async () => {
    const result = await compile('正文 <span style="color:#e53935;position:fixed;background:url(https://example.com)" onclick="alert(1)">重点</span>。')
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    expect(result.html).toContain('color:#e53935')
    expect(result.html).not.toMatch(/onclick|position:fixed|url\(|https:\/\/example.com/)
    expect(textOf(parseFragment(result.html))).toBe('正文 重点。')
  })

  it('支持颜色与字号组合应用并通过合规校验', async () => {
    const source = '默认正文，以及局部大字测试。'
    const formatted = applyInlineTextStyle(source, [selected(source, '局部大字')], {
      fontSize: '20px',
      color: '#1d4ed8',
    })
    expect(formatted).toContain(
      '<span style="color:#1d4ed8;font-size:20px">局部大字</span>',
    )

    const result = await compile(formatted)
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    expect(result.html).toContain('font-size:20px')
    expect(result.html).toContain('color:#1d4ed8')
  })

  it('忽略旧文档中的局部字体声明，保留文字、颜色和字号', async () => {
    expect(INLINE_FONT_SIZE_PRESETS.length).toBeGreaterThan(0)
    expect(serializeInlineTextStyle({ fontSize: '16px' })).toBe('font-size:16px')
    expect(parseInlineTextStyle('font-family:SimSun, Songti SC, serif;color:#E53935;font-size:18px')).toEqual({ color: '#e53935', fontSize: '18px' })
    expect(parseInlineTextStyle("font-family:'MiSans', sans-serif")).toEqual({})
    const source = '正文 <span style="color:#e53935;font-size:18px;font-family:SimSun, Songti SC, serif">旧样式</span> 和 <span style="font-family:MiSans,sans-serif">旧字体</span>。'
    const result = await compile(source)
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok')
    expect(textOf(parseFragment(result.html))).toBe('正文 旧样式 和 旧字体。')
    expect(result.html).toContain('color:#e53935')
    expect(result.html).toContain('font-size:18px')
    expect(result.html).not.toMatch(/SimSun|Songti SC|MiSans/)
  })
})
