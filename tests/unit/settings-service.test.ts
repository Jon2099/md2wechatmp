import { beforeEach, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DEFAULT_SETTINGS } from '@shared/schemas/settings'
import { settingsPatchSchema } from '@shared/schemas/ipc'

const h = vi.hoisted(() => ({ root: '', fail: false }))
vi.mock('electron', () => ({ app: { getPath: () => h.root } }))
vi.mock('../../src/main/store/atomic-write', () => ({
  writeFileAtomic: async (path: string, content: string) => {
    if (h.fail) throw new Error('disk full')
    const actual = await vi.importActual<typeof import('../../src/main/store/atomic-write')>('../../src/main/store/atomic-write')
    return actual.writeFileAtomic(path, content)
  },
}))
beforeEach(async () => {
  vi.resetModules()
  h.fail = false
  await mkdir(resolve('tests/.tmp'), { recursive: true })
  h.root = await mkdtemp(resolve('tests/.tmp/settings-'))
})

it('从旧设置迁移后可关闭标题；其他选项更新和重启不会重置该选择', async () => {
  const { includeTitle: _, ...legacyOptions } = DEFAULT_SETTINGS.options
  await writeFile(join(h.root, 'settings.json'), JSON.stringify({ ...DEFAULT_SETTINGS, themeId: 'jade', options: legacyOptions }))
  const service = await import('../../src/main/services/settings-service')
  expect((await service.loadSettings()).options.includeTitle).toBe(true)
  await service.saveSettings(settingsPatchSchema.parse({ options: { includeTitle: false, mathMode: 'raw' } }))
  await service.saveSettings(settingsPatchSchema.parse({ options: { highlight: false } }))
  vi.resetModules()
  const reloaded = await import('../../src/main/services/settings-service')
  expect(await reloaded.loadSettings()).toMatchObject({ themeId: 'jade', options: { includeTitle: false, mathMode: 'raw', highlight: false } })
})

it('并发更新不同设置与嵌套选项后，内存和磁盘都保留全部补丁', async () => {
  const service = await import('../../src/main/services/settings-service')
  const results = await Promise.all([
    service.saveSettings({ themeId: 'jade' }),
    service.saveSettings({ previewWidth: 430 }),
    service.saveSettings({ options: { highlight: false } }),
    service.saveSettings({ options: { firstLineIndent: true } }),
  ])
  const settings = await service.loadSettings()
  expect(settings).toMatchObject({ themeId: 'jade', previewWidth: 430, options: { highlight: false, firstLineIndent: true } })
  expect(JSON.parse(await readFile(join(h.root, 'settings.json'), 'utf8'))).toEqual(settings)
  expect(results.at(-1)).toEqual(settings)
})

it('保存失败不污染缓存，后续保存能够继续', async () => {
  const service = await import('../../src/main/services/settings-service')
  await service.loadSettings()
  h.fail = true
  await expect(service.saveSettings({ themeId: 'jade' })).rejects.toThrow('disk full')
  expect((await service.loadSettings()).themeId).toBe('ocean-blue')
  h.fail = false
  const saved = await service.saveSettings({ previewWidth: 430 })
  expect(saved).toMatchObject({ themeId: 'ocean-blue', previewWidth: 430 })
})

it('支持保存与更新定时自动保存间隔，并提供默认 3 秒', async () => {
  const service = await import('../../src/main/services/settings-service')
  expect((await service.loadSettings()).autoSaveInterval).toBe(3)
  const updated = await service.saveSettings({ autoSaveInterval: 120 })
  expect(updated.autoSaveInterval).toBe(120)
  expect((await service.loadSettings()).autoSaveInterval).toBe(120)
})
