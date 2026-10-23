import { describe, expect, it } from 'vitest'
import { buildThemeCss, findForbiddenCss } from '@themes/build-css'
import { THEMES, themeSummaries } from '@themes/builtins/index'
import { themeProfileSchema } from '@themes/schema'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'
import { compile } from '../helpers/compile'

describe('主题', () => {
  it('八套内置主题全部通过 Zod 校验', () => {
    expect(THEMES).toHaveLength(8)
    for (const theme of THEMES) {
      expect(() => themeProfileSchema.parse(theme)).not.toThrow()
    }
    expect(themeSummaries().map((item) => item.id)).toEqual([
      'ocean-blue',
      'graphite',
      'terracotta',
      'jade',
      'magazine',
      'amber',
      'violet',
      'ink',
    ])
  })

  it('生成的 CSS 不含变量、伪元素与相对单位', () => {
    for (const theme of THEMES) {
      const { css } = buildThemeCss(theme, DEFAULT_COMPILE_OPTIONS)
      expect(findForbiddenCss(css)).toEqual([])
      expect(css).not.toContain('class=')
    }
  })

  it('每套主题都能完成整篇转换且不缺失类名', async () => {
    const markdown = [
      '---',
      'title: 主题覆盖样稿',
      'eyebrow: 专题',
      'notice: 本文含图片占位，粘贴后请逐个替换。',
      '---',
      '',
      '# 标题',
      '',
      '正文里有 **重点**、*斜体*、~~删除~~、`code` 与 [链接](https://example.com)，并引用脚注[^1]。',
      '',
      '## 小节',
      '',
      '### 三级标题',
      '',
      '#### 四级标题',
      '',
      '##### 五级标题',
      '',
      '###### 六级标题',
      '',
      '> **提示**',
      '> · 一',
      '> · 二',
      '',
      '> [!WARNING]',
      '> 警告样式的提示块。',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '---',
      '',
      '- 项目一',
      '- 项目二',
      '',
      '1. 第一步',
      '2. 第二步',
      '',
      '- [x] 已完成',
      '- [ ] 未完成',
      '',
      '![示意图](https://example.com/a.png)',
      '',
      '```ts',
      'const value = 1',
      '```',
      '',
      '$$',
      'a^2 + b^2 = c^2',
      '$$',
      '',
      '[^1]: 脚注内容在这里。',
    ].join('\n')

    for (const theme of THEMES) {
      const snapshot = await compile(markdown, { themeId: theme.id })
      expect(snapshot.status, `${theme.id}: ${JSON.stringify(snapshot.diagnostics)}`).toBe('ok')
      expect(snapshot.html.startsWith('<section')).toBe(true)
      expect(snapshot.html).not.toContain('class=')
      expect(snapshot.html).not.toContain('id=')
    }
  })
})
