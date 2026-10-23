import { CHANNELS } from '@shared/contracts/ipc'
import type { SettingsPatch } from '@shared/contracts/ipc'
import { settingsPatchSchema } from '@shared/schemas/ipc'
import { loadSettings, saveSettings } from '../services/settings-service'
import { handle } from './register'

export function registerSettingsIpc(): void {
  handle(CHANNELS.settingsGet, null, () => loadSettings())
  handle(CHANNELS.settingsUpdate, settingsPatchSchema, (payload) =>
    saveSettings(payload as SettingsPatch),
  )
}
