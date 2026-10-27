import type { ThemeProfile } from '@shared/models/theme'

export type EditorTab = 'colors' | 'typography' | 'elements'

export function cloneProfile(source: ThemeProfile): ThemeProfile {
  return JSON.parse(JSON.stringify(source))
}
