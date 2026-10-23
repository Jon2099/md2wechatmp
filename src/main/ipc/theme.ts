import { z } from 'zod'
import { CHANNELS } from '@shared/contracts/ipc'
import type { ThemeProfile, ThemeSummary } from '@shared/models/theme'
import { themeProfileSchema } from '@themes/schema'
import { themeService } from '../services/theme-service'
import { handle } from './register'

const idSchema = z.object({ id: z.string().min(1).max(64) }).strict()

export function registerThemeIpc(): void {
  handle<ThemeSummary[]>(CHANNELS.themeList, null, async () => {
    await themeService.loadThemes()
    return themeService.listThemes()
  })

  handle<ThemeProfile>(CHANNELS.themeGet, idSchema, async (payload) => {
    await themeService.loadThemes()
    const { id } = payload as { id: string }
    return themeService.getTheme(id)
  })

  handle<ThemeSummary>(CHANNELS.themeSaveCustom, themeProfileSchema, async (payload) => {
    return themeService.saveCustomTheme(payload as ThemeProfile)
  })

  handle<{ deleted: boolean }>(CHANNELS.themeDeleteCustom, idSchema, async (payload) => {
    const { id } = payload as { id: string }
    const deleted = await themeService.deleteCustomTheme(id)
    return { deleted }
  })
}
