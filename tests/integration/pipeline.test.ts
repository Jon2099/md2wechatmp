import { describe, expect, it } from 'vitest'
import { compile } from '../helpers/compile'

const MIXED = [
  '---',
  'title: 混合样稿',
  'eyebrow: 测试 · 排版',
  'author: 测试',
  'custom: 未启用字段',
  '---',
  '',
  '# 一级标题',
  '',
  '普通段落，含 **加粗**、*斜体*、~~删除线~~、`行内代码` 与 [外链](https://example.com/a)。',
  '',
  '## 二级标题',
  '',
  '> **结论**',
  '> · 要点一',
  '> · 要点二',
  '',
  '> 普通引用',
  '',
  '![图](https://example.com/pic.png)',
  '',
  '| 列一 | 列二 |',
  '| :--- | ---: |',
  '| 甲 | 乙 |',
  '',
  '1. 第一步',
  '2. 第二步',
  '',
  '- [x] 完成',
  '- [ ] 待办',
  '',
  '---',
  '',
  '```bash',
  'echo "hi"',
  '```',
  '',
  '$$',
  'a^2 + b^2 = c^2',
  '$$',
  '',
  '<div>原始 HTML</div>',
].join('\n')

describe('整管线', () => {
  it('混合样稿可完整转换且输出干净', async () => {
    const snapshot = await compile(MIXED)

    expect(snapshot.html).not.toContain('<div')
    expect(snapshot.html).not.toContain('<style')
    expect(snapshot.html).not.toContain('class=')
    expect(snapshot.html).toContain('src="https://example.com/pic.png"')
    expect(snapshot.html).not.toContain('var(')
    expect(snapshot.html).not.toContain('::')
    expect(snapshot.html).not.toContain('url(')

    expect(snapshot.meta.title).toBe('混合样稿')
    expect(snapshot.html).toContain('测试 · 排版')
    expect(snapshot.diagnostics.some((item) => item.code === 'frontmatter.ignored-key')).toBe(true)
    expect(snapshot.diagnostics.some((item) => item.code === 'html.unsupported-tag')).toBe(true)
    expect(snapshot.placeholders).toHaveLength(0)
  })

  it('HTML 与纯文本的占位、编号保持一致', async () => {
    const snapshot = await compile(MIXED)
    const htmlPlaceholders = snapshot.html.split('TODO： ').length - 1
    const plainPlaceholders = snapshot.plainText.split('TODO： ').length - 1
    expect(htmlPlaceholders).toBe(0)
    expect(plainPlaceholders).toBe(0)
    expect(snapshot.html).toContain('<img ')
    expect(snapshot.plainText).toContain('[图片：图]')
    expect(snapshot.plainText).toContain('[链接 1]')
    expect(snapshot.plainText).toContain('https://example.com/a')
  })

  it('空文档不报错', async () => {
    const snapshot = await compile('')
    expect(snapshot.status).toBe('ok')
    expect(snapshot.plainText).toBe('')
  })

  it('超长内容按限制拒绝', async () => {
    const huge = 'a'.repeat(1_000_001)
    await expect(compile(huge)).rejects.toThrow(/超过上限/)
  })
})
