import type { ThemeProfile } from '@shared/models/theme'

export const SANS_STACK =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
export const SERIF_STACK =
  "'Times New Roman', Times, Cambria, 'Songti SC', 'STSong', '华文宋体', 'Source Han Serif SC', 'Noto Serif SC', 'PingFang SC', 'Microsoft YaHei', serif"
export const MONO_STACK =
  "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace"

export type DeepPartial<T> = T extends readonly (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function merge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (patch === undefined) return base
  if (Array.isArray(base) || !isPlainObject(base) || !isPlainObject(patch)) {
    return patch as unknown as T
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue
    const current = result[key]
    result[key] = isPlainObject(current) && isPlainObject(value) ? merge(current, value) : value
  }
  return result as T
}

/** 深海蓝：与手工改造的合规版案例保持一致的基准主题 */
export const BASE_THEME: ThemeProfile = {
  id: 'ocean-blue',
  name: '深海蓝',
  version: 1,
  description: '经典深蓝标题与左侧重点竖线，适合技术长文、深度报道与商业分析。',
  font: { body: SANS_STACK, heading: SANS_STACK, mono: MONO_STACK },
  sizes: { body: 15, list: 14, table: 13, tableSmall: 12.5, code: 13, small: 12.5 },
  colors: {
    text: '#2d2d2d',
    textSecondary: '#475569',
    textMuted: '#64748b',
    heading: '#111827',
    strong: '#111827',
    accent: '#1d4ed8',
    accentSoft: '#eff6ff',
    background: '#ffffff',
    surface: '#f8fafc',
    border: '#e2e8f0',
    codeBg: '#f3f5f9',
    codeBorder: '#e2e8f0',
    codeText: '#0f172a',
    link: '#1d4ed8',
    linkRef: '#1d4ed8',
    quoteBg: '#f8fafc',
    quoteBorder: '#94a3b8',
    quoteText: '#475569',
    tableHeaderBg: '#eef2f9',
    tableBorder: '#dbe3ec',
    tableText: '#334155',
    tableHeaderText: '#111827',
    zebra: '#f8fafc',
    divider: '#e8edf4',
  },
  paragraph: { lineHeight: 1.78, letterSpacing: 0.2, gap: 18, align: 'left', firstLineIndentPx: 0 },
  headings: {
    numbering: 'none',
    levels: [
      {
        size: 21,
        marginTop: 0,
        marginBottom: 22,
        weight: 700,
        lineHeight: 1.45,
        align: 'left',
        borderSide: 'bottom',
        borderWidth: 2,
        borderColor: '#1d4ed8',
        paddingBottom: 14,
      },
      {
        size: 17,
        marginTop: 26,
        marginBottom: 14,
        weight: 700,
        lineHeight: 1.5,
        align: 'left',
        borderSide: 'left',
        borderWidth: 4,
        borderColor: '#1d4ed8',
        paddingLeft: 11,
      },
      { size: 16, marginTop: 22, marginBottom: 11, weight: 700, lineHeight: 1.55, align: 'left' },
      { size: 15, marginTop: 20, marginBottom: 10, weight: 700, lineHeight: 1.6, align: 'left' },
      { size: 14, marginTop: 18, marginBottom: 9, weight: 700, lineHeight: 1.6, align: 'left' },
      { size: 13, marginTop: 16, marginBottom: 8, weight: 700, lineHeight: 1.6, align: 'left' },
    ],
  },
  quote: {
    shape: 'bar',
    bg: '#f8fafc',
    border: '#94a3b8',
    barWidth: 3,
    radius: 4,
    paddingY: 13,
    paddingX: 15,
    fontSize: 14,
    lineHeight: 1.72,
  },
  callout: {
    bg: '#f4faf8',
    border: '#cfe4df',
    titleColor: '#1d4ed8',
    barWidth: 4,
    radius: 4,
    paddingY: 15,
    paddingX: 17,
    titleSize: 15,
    warnBg: '#fffbeb',
    warnBorder: '#fed7aa',
    warnTitleColor: '#c2410c',
  },
  code: {
    inlineBg: '#f3f5f9',
    inlineBorder: '#e2e8f0',
    inlineColor: '#0f172a',
    inlineRadius: 3,
    inlinePaddingY: 1,
    inlinePaddingX: 5,
    blockBg: '#f8fafc',
    blockBorder: '#e2e8f0',
    blockColor: '#0f172a',
    blockRadius: 4,
    blockPaddingY: 14,
    blockPaddingX: 15,
    blockLineHeight: 1.7,
    tabSize: 2,
  },
  table: {
    borderWidth: 1,
    cellPaddingY: 9,
    cellPaddingX: 8,
    headerBg: '#eef2f9',
    headerColor: '#111827',
    headerStyle: 'all',
    zebra: true,
    lineHeight: 1.62,
  },
  list: {
    indentPx: 20,
    itemGap: 9,
    bulletLevels: ['disc', 'circle', 'square'],
    orderedLevels: ['decimal', 'lower-alpha', 'lower-roman'],
  },
  divider: { form: 'block', color: '#e8edf4', thickness: 1, marginY: 30 },
  eyebrow: { size: 13, weight: 700, letterSpacing: 1, color: '#1d4ed8', marginBottom: 12 },
  linkRef: { size: 12.5, color: '#1d4ed8' },
  footer: { size: 12.5, color: '#64748b', borderColor: '#e2e8f0' },
  labels: { linkSection: '参考链接', footnoteSection: '注释' },
  shiki: { theme: 'github-light' },
}

export interface ThemeSpec extends DeepPartial<ThemeProfile> {
  id: ThemeProfile['id']
  name: string
  description: string
}

export function defineTheme(spec: ThemeSpec): ThemeProfile {
  return merge(BASE_THEME, spec)
}
