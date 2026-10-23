import type { ThemeProfile } from '@shared/models/theme'

export const PREVIEW_LABELS = {
  accent: '品牌主色 · 提示块强调线', title: '文章标题', paragraph: '正文与段落',
  strong: '加粗文字', link: '链接文字', secondary: '次要文字与脚注',
  paper: '页面底色', border: '边框底线', headings: '标题层级与编号',
  quote: '引用块', code: '行内代码与代码块', table: '表格与隔行底色', divider: '分割线',
} as const
export type PreviewTarget = keyof typeof PREVIEW_LABELS

// Capture values, not proxies: Vue's deep-watch oldValue shares the current proxy.
// Metadata is omitted so renaming a theme does not move the article.
export function previewValues(theme: ThemeProfile): Record<PreviewTarget, string> {
  const values: Record<PreviewTarget, unknown> = {
    accent: theme.colors.accent,
    title: [theme.colors.heading, theme.font.heading, theme.headings.levels[0]],
    paragraph: [theme.colors.text, theme.font.body, theme.sizes.body, theme.paragraph],
    strong: theme.colors.strong, link: theme.colors.link,
    secondary: theme.colors.textSecondary, paper: theme.colors.background, border: theme.colors.border,
    headings: [theme.headings.numbering, theme.headings.levels.slice(1)],
    quote: theme.quote, code: [theme.font.mono, theme.code],
    table: [theme.table, theme.colors.zebra], divider: theme.divider,
  }
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)])) as Record<PreviewTarget, string>
}

export function changedPreviewTarget(next: Record<PreviewTarget, string>, previous: Record<PreviewTarget, string>): PreviewTarget | undefined {
  return (Object.keys(PREVIEW_LABELS) as PreviewTarget[]).find(key => next[key] !== previous[key])
}

export function previewHeadingPrefix(numbering: ThemeProfile['headings']['numbering'], index: number): string {
  if (numbering === 'h2-two-digit') return `${String(index).padStart(2, '0')} `
  if (numbering === 'h2-cn') return `${['一', '二', '三', '四', '五', '六'][index - 1] ?? index}、`
  return ''
}
