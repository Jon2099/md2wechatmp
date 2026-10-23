import type { ThemeId, ThemeProfile, ThemeSummary } from '@shared/models/theme'
import { parseTheme } from '../schema'
import { AMBER } from './amber'
import { GRAPHITE } from './graphite'
import { INK } from './ink'
import { JADE } from './jade'
import { MAGAZINE } from './magazine'
import { OCEAN_BLUE } from './ocean-blue'
import { TERRACOTTA } from './terracotta'
import { VIOLET } from './violet'

const RAW_THEMES: ThemeProfile[] = [
  OCEAN_BLUE,
  GRAPHITE,
  TERRACOTTA,
  JADE,
  MAGAZINE,
  AMBER,
  VIOLET,
  INK,
]

export const THEMES: ThemeProfile[] = RAW_THEMES.map((theme) => parseTheme(theme))

const THEME_MAP = new Map<string, ThemeProfile>(THEMES.map((theme) => [theme.id, theme]))

export const DEFAULT_THEME_ID: ThemeId = 'ocean-blue'

export function getTheme(id: string): ThemeProfile {
  return THEME_MAP.get(id) ?? THEMES[0]
}

export function themeSummaries(): ThemeSummary[] {
  return THEMES.map((theme) => ({
    id: theme.id,
    name: theme.name,
    description: theme.description,
    accent: theme.colors.accent,
  }))
}
