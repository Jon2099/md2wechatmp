import { expect, it } from 'vitest'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'
import { compileRequestSchema, settingsPatchSchema, themeIdSchema } from '@shared/schemas/ipc'

it('已保存的自定义主题 ID 可用于切换设置和编译请求', () => {
  const themeId = 'custom-1761227471904'
  expect(settingsPatchSchema.parse({ themeId }).themeId).toBe(themeId)
  expect(compileRequestSchema.parse({ docId: 'doc-test', revision: 1, themeId, options: DEFAULT_COMPILE_OPTIONS }).themeId).toBe(themeId)
})

it('仍然拒绝未知内置主题、空自定义 ID 和路径字符', () => {
  for (const invalid of ['unknown-theme', 'custom-', 'custom-../escape', `custom-${'a'.repeat(64)}`]) {
    expect(themeIdSchema.safeParse(invalid).success).toBe(false)
  }
})
