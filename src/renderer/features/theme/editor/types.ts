import type { ThemeProfile } from '@shared/models/theme'

export type EditorTab = 'colors' | 'typography' | 'elements'

export interface FontPreset {
  label: string
  value: string
}

export const BODY_FONT_PRESETS: FontPreset[] = [
  { label: '系统默认无衬线', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' },
  { label: '微信推荐排版', value: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif' },
  { label: '人文雅致衬线', value: '"Songti SC", "SimSun", "Source Han Serif SC", Georgia, serif' },
  { label: '温润文楷手写', value: '"LXGW WenKai", "Kaiti SC", "KaiTi", "STKaiti", serif' },
]

export const HEADING_FONT_PRESETS: FontPreset[] = [
  { label: '跟随正文字体', value: '' },
  { label: '加粗无衬线', value: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '经典报刊衬线', value: '"Songti SC", "SimSun", Georgia, serif' },
]

export const MONO_FONT_PRESETS: FontPreset[] = [
  { label: '标准等宽代码', value: 'Consolas, Monaco, "Courier New", monospace' },
  { label: '现代代码 JetBrains/Fira', value: '"JetBrains Mono", "Fira Code", Consolas, monospace' },
]

export function cloneProfile(source: ThemeProfile): ThemeProfile {
  return JSON.parse(JSON.stringify(source))
}
