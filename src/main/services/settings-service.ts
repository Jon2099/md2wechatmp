import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppSettings } from '@shared/models/document'
import type { SettingsPatch } from '@shared/contracts/ipc'
import { DEFAULT_SETTINGS, normalizeSettings } from '@shared/schemas/settings'
import { writeFileAtomic } from '../store/atomic-write'

let cache: AppSettings | null = null
let loading: Promise<AppSettings> | null = null
let writes: Promise<unknown> = Promise.resolve()

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function loadSettings(): Promise<AppSettings> {
  if (cache) return cache
  if (!loading) {
    loading = readFile(settingsPath(), 'utf8')
      .then((raw) => normalizeSettings(JSON.parse(raw)))
      .catch(() => ({ ...DEFAULT_SETTINGS, options: { ...DEFAULT_SETTINGS.options } }))
      .then((settings) => { cache = settings; return settings })
      .finally(() => { loading = null })
  }
  return loading
}

export function saveSettings(patch: SettingsPatch): Promise<AppSettings> {
  const captured = { ...patch, options: { ...patch.options } }
  const saving = writes.catch(() => undefined).then(async () => {
    const current = await loadSettings()
    const next = normalizeSettings({
      ...current,
      ...captured,
      options: { ...current.options, ...captured.options },
    })
    await writeFileAtomic(settingsPath(), JSON.stringify(next, null, 2))
    cache = next
    return next
  })
  writes = saving
  return saving
}
