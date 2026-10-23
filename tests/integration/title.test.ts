import { describe, expect, it } from 'vitest'
import { compile, errorsOf } from '../helpers/compile'

describe('文章标题输出选项', () => {
  it('默认包含标题；关闭后 HTML、纯文本和统计同步排除标题，源文哈希保持不变', async () => {
    const source = '# 文章大标题\n\n正文内容。\n\n## 正文章节\n\n章节内容。'
    const included = await compile(source)
    const omitted = await compile(source, { options: { includeTitle: false } })
    expect(included.html).toContain('文章大标题')
    expect(included.plainText).toContain('文章大标题')
    expect(included.options.includeTitle).toBe(true)
    expect(omitted.html).not.toContain('文章大标题')
    expect(omitted.plainText).not.toContain('文章大标题')
    expect(omitted.plainText).toContain('正文内容。')
    expect(omitted.plainText).toContain('正文章节')
    expect(omitted.meta.title).toBe('文章大标题')
    expect(omitted.stats.chars).toBeLessThan(included.stats.chars)
    expect(omitted.sourceHash).toBe(included.sourceHash)
    expect(omitted.id).not.toBe(included.id)
    expect(errorsOf(omitted)).toEqual([])
  })

  it.each(['# **一级**标题\r\n', '一级标题\n========\n'])('支持 ATX / Setext 和行尾格式：%s', async title => {
    const result = await compile(`${title}\n正文内容。`, { options: { includeTitle: false } })
    expect(result.meta.title).toBe('一级标题')
    expect(result.plainText.trim()).toBe('正文内容。')
    expect(errorsOf(result)).toEqual([])
  })

  it('只移除第一个顶层一级标题，保留后续一级标题和二至六级标题', async () => {
    const result = await compile('# 文章标题\n\n# 另一章节\n\n## 二级章节\n\n### 三级章节\n\n#### 四级章节\n\n##### 五级章节\n\n###### 六级章节', { options: { includeTitle: false } })
    expect(result.plainText).not.toContain('文章标题')
    for (const title of ['另一章节', '二级章节', '三级章节', '四级章节', '五级章节', '六级章节']) {
      expect(result.plainText).toContain(title)
    }
  })

  it('没有顶层一级标题时，章节标题、引用内标题和代码中的 # 均保留', async () => {
    const source = '> # 引用内标题\n\n## 正文章节\n\n```md\n# 代码中的标题\n```'
    const included = await compile(source)
    const omitted = await compile(source, { options: { includeTitle: false } })
    expect(omitted.html).toBe(included.html)
    expect(omitted.plainText).toBe(included.plainText)
  })

  it('隐藏标题中的链接、图片和视频不会产生文末编号、读取错误或占位符', async () => {
    const result = await compile('# [标题链接](https://example.com/title) ![图片](missing.png) ![视频](missing.mp4)\n\n正文内容。', { options: { includeTitle: false } })
    expect(result.links).toEqual([])
    expect(result.placeholders).toEqual([])
    expect(result.stats.images).toBe(0)
    expect(result.plainText.trim()).toBe('正文内容。')
    expect(errorsOf(result)).toEqual([])
  })

  it('保留 Front Matter 的标题、眉标和提示信息', async () => {
    const result = await compile('---\ntitle: 元数据标题\neyebrow: 专栏眉标\nnotice: 阅读提示\n---\n\n# 正文标题\n\n正文内容。', { options: { includeTitle: false } })
    expect(result.meta.title).toBe('元数据标题')
    expect(result.html).not.toContain('正文标题')
    expect(result.html).toContain('专栏眉标')
    expect(result.html).toContain('阅读提示')
  })

  it('有意省略超长标题或仅标题的文档，不误报正文丢失', async () => {
    for (const source of [`# ${'很长的标题'.repeat(100)}\n\n正文。`, '# 只有标题']) {
      const result = await compile(source, { options: { includeTitle: false } })
      expect(errorsOf(result)).toEqual([])
      expect(result.status).toBe('ok')
    }
  })
})
