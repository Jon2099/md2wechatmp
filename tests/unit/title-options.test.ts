import { expect, it } from 'vitest'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'
import { DEFAULT_SETTINGS, normalizeSettings } from '@shared/schemas/settings'
import { compileOptionsSchema, settingsPatchSchema } from '@shared/schemas/ipc'

it('旧版设置和编译请求缺少标题选项时保持默认开启，同时保留其他设置', () => {
  const { includeTitle: _, ...legacyOptions } = DEFAULT_COMPILE_OPTIONS
  const options = { ...legacyOptions, highlight: false }
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, themeId: 'jade', previewWidth: 430, options })
  expect(settings).toMatchObject({ themeId: 'jade', previewWidth: 430, options: { includeTitle: true, highlight: false } })
  expect(compileOptionsSchema.parse(options).includeTitle).toBe(true)
})

it('允许保存关闭标题，但拒绝非布尔选项', () => {
  expect(settingsPatchSchema.parse({ options: { includeTitle: false } }).options?.includeTitle).toBe(false)
  expect(compileOptionsSchema.safeParse({ ...DEFAULT_COMPILE_OPTIONS, includeTitle: 'false' }).success).toBe(false)
  expect(settingsPatchSchema.safeParse({ options: { includeTitle: 0 } }).success).toBe(false)
})

it('更新其他设置时，不会在补丁里自动填入标题选项而覆盖已有选择', () => {
  const patch = settingsPatchSchema.parse({ options: { highlight: false } })
  expect(patch.options).toEqual({ highlight: false })
})

