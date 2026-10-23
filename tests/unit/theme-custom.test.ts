import { describe, expect, it, beforeEach, vi } from 'vitest'
import { join } from 'node:path'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { THEMES } from '@themes/builtins/index'
import { compileDocument } from '@converter/index'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'

const h = vi.hoisted(() => ({ root: '' }))
vi.mock('electron', () => ({ app: { getPath: () => h.root } }))

describe('自定义主题系统 (Custom Themes)', () => {
  beforeEach(async () => {
    vi.resetModules()
    await mkdir('tests/.tmp', { recursive: true })
    h.root = await mkdtemp(join('tests/.tmp', 'theme-test-'))
  })

  it('支持基于内置主题克隆、修改多维度并保存到本地', async () => {
    const { themeService } = await import('../../src/main/services/theme-service')
    const base = THEMES[0]
    const custom = {
      ...base,
      id: 'custom-tech-emerald',
      name: '科技翠绿',
      description: '为微信公众号专门定制的微光翠绿主题',
      colors: {
        ...base.colors,
        accent: '#07c160',
        heading: '#06ad56',
        strong: '#047857',
        link: '#07c160',
      },
      paragraph: {
        ...base.paragraph,
        lineHeight: 1.95,
        letterSpacing: 1.5,
      },
    }

    const summary = await themeService.saveCustomTheme(custom)
    expect(summary.isCustom).toBe(true)
    expect(summary.name).toBe('科技翠绿')
    expect(summary.accent).toBe('#07c160')

    const list = themeService.listThemes()
    expect(list.some((t) => t.id === 'custom-tech-emerald')).toBe(true)

    const retrieved = themeService.getTheme('custom-tech-emerald')
    expect(retrieved.name).toBe('科技翠绿')
    expect(retrieved.colors.accent).toBe('#07c160')
    expect(retrieved.paragraph.lineHeight).toBe(1.95)

    // 编译测试：验证自定义字号、间距与配色被正确行内渲染
    const snapshot = await compileDocument({
      docId: 'doc-1',
      revision: 1,
      markdown: '# 标题\n\n正文段落强调 **重点内容** 与 [链接](https://example.com)。',
      theme: retrieved,
      options: DEFAULT_COMPILE_OPTIONS,
    })

    expect(snapshot.html).toContain('#07c160')
    expect(snapshot.html).toContain('line-height:1.95')
    expect(snapshot.html).toContain('letter-spacing:1.5px')
    expect(snapshot.html).toContain('#06ad56')
    expect(snapshot.html).toContain('#047857')

    // 删除测试
    const deleted = await themeService.deleteCustomTheme('custom-tech-emerald')
    expect(deleted).toBe(true)
    expect(themeService.listThemes().some((t) => t.id === 'custom-tech-emerald')).toBe(false)
  })
})
