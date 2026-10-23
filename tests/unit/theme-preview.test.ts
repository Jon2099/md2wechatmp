import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { THEMES } from '@themes/builtins/index'
import { changedPreviewTarget, previewHeadingPrefix, previewValues, type PreviewTarget } from '../../src/renderer/features/theme/editor/preview-model'
import type { ThemeProfile } from '@shared/models/theme'

describe('主题预览定位', () => {
  const cases: [PreviewTarget, (theme: ThemeProfile) => void][] = [
    ['accent', theme => { theme.colors.accent = '#ff0000' }],
    ['title', theme => { theme.headings.levels[0].size++ }],
    ['title', theme => { theme.colors.heading = '#ff0000' }],
    ['paragraph', theme => { theme.paragraph.firstLineIndentPx = 32 }],
    ['paragraph', theme => { theme.sizes.body++ }],
    ['strong', theme => { theme.colors.strong = '#ff0000' }],
    ['link', theme => { theme.colors.link = '#ff0000' }],
    ['secondary', theme => { theme.colors.textSecondary = '#ff0000' }],
    ['paper', theme => { theme.colors.background = '#ff0000' }],
    ['border', theme => { theme.colors.border = '#ff0000' }],
    ['headings', theme => { theme.headings.numbering = 'h2-cn' }],
    ['headings', theme => { theme.headings.levels[1].size++ }],
    ['quote', theme => { theme.quote.radius = 8 }],
    ['code', theme => { theme.code.blockBg = '#ff0000' }],
    ['code', theme => { theme.font.mono = 'monospace' }],
    ['table', theme => { theme.table.zebra = !theme.table.zebra }],
    ['divider', theme => { theme.divider.form = 'dotted' }],
  ]
  it.each(cases)('修改 %s 时定位对应示例（捕获嵌套响应式修改）', (target, mutate) => {
    const theme = reactive(structuredClone(THEMES[0]))
    const before = previewValues(theme)
    mutate(theme)
    expect(changedPreviewTarget(previewValues(theme), before)).toBe(target)
  })

  it('名称与描述不触发样稿滚动', () => {
    const theme = structuredClone(THEMES[0])
    const before = previewValues(theme)
    theme.name = '另一个名称'
    theme.description = '新的描述'
    expect(changedPreviewTarget(previewValues(theme), before)).toBeUndefined()
  })

  it('标题编号覆盖无编号、阿拉伯数字与中文小节', () => {
    expect(previewHeadingPrefix('none', 1)).toBe('')
    expect(previewHeadingPrefix('h2-two-digit', 4)).toBe('04 ')
    expect(previewHeadingPrefix('h2-cn', 4)).toBe('四、')
  })
})
