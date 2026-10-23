import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ThemeProfile, ThemeSummary } from '@shared/models/theme'
import { THEMES, getTheme as getBuiltinTheme } from '@themes/builtins/index'
import { parseTheme, themeProfileSchema } from '@themes/schema'
import { writeFileAtomic } from '../store/atomic-write'

class ThemeService {
  private customThemes: Map<string, ThemeProfile> = new Map()
  private loaded = false
  private writes: Promise<unknown> = Promise.resolve()

  private filePath(): string {
    return join(app.getPath('userData'), 'custom-themes.json')
  }

  async loadThemes(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await readFile(this.filePath(), 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        this.customThemes.clear()
        for (const item of parsed) {
          const res = themeProfileSchema.safeParse(item)
          if (res.success) {
            this.customThemes.set(res.data.id, res.data as ThemeProfile)
          }
        }
      }
    } catch {
      this.customThemes.clear()
    } finally {
      this.loaded = true
    }
  }

  listThemes(): ThemeSummary[] {
    const builtins: ThemeSummary[] = THEMES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      accent: t.colors.accent,
      isCustom: false,
    }))
    const customs: ThemeSummary[] = Array.from(this.customThemes.values()).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      accent: t.colors.accent,
      isCustom: true,
    }))
    return [...builtins, ...customs]
  }

  getTheme(id: string): ThemeProfile {
    return this.customThemes.get(id) ?? getBuiltinTheme(id)
  }

  getCustomTheme(id: string): ThemeProfile | null {
    return this.customThemes.get(id) ?? null
  }

  async saveCustomTheme(profile: ThemeProfile): Promise<ThemeSummary> {
    await this.loadThemes()
    let id = profile.id
    const isBuiltin = THEMES.some((b) => b.id === id)
    if (!id || isBuiltin || !id.startsWith('custom-')) {
      id = `custom-${Date.now()}`
    }
    const validated = parseTheme({ ...profile, id })
    this.customThemes.set(id, validated)

    const saving = this.writes.catch(() => undefined).then(async () => {
      const data = Array.from(this.customThemes.values())
      await writeFileAtomic(this.filePath(), JSON.stringify(data, null, 2))
    })
    this.writes = saving
    await saving

    return {
      id: validated.id,
      name: validated.name,
      description: validated.description,
      accent: validated.colors.accent,
      isCustom: true,
    }
  }

  async deleteCustomTheme(id: string): Promise<boolean> {
    await this.loadThemes()
    if (!this.customThemes.has(id)) return false
    this.customThemes.delete(id)

    const saving = this.writes.catch(() => undefined).then(async () => {
      const data = Array.from(this.customThemes.values())
      await writeFileAtomic(this.filePath(), JSON.stringify(data, null, 2))
    })
    this.writes = saving
    await saving
    return true
  }
}

export const themeService = new ThemeService()
