export type ThemeId =
  | 'ocean-blue'
  | 'graphite'
  | 'terracotta'
  | 'jade'
  | 'magazine'
  | 'amber'
  | 'violet'
  | 'ink'

export type HeadingAlign = 'left' | 'center'
export type BorderSide = 'bottom' | 'left' | 'top'
export type DividerForm = 'block' | 'line' | 'dashed' | 'dotted'
export type QuoteShape = 'bar' | 'panel'
export type HeaderStyle = 'all' | 'rule'
export type NumberingStyle = 'none' | 'h2-two-digit' | 'h2-cn'

export interface HeadingLevelStyle {
  size: number
  marginTop: number
  marginBottom: number
  weight: number
  lineHeight: number
  align: HeadingAlign
  borderSide?: BorderSide
  borderWidth?: number
  borderColor?: string
  paddingBottom?: number
  paddingLeft?: number
  letterSpacing?: number
  color?: string
}

export interface ThemeColors {
  text: string
  textSecondary: string
  textMuted: string
  heading: string
  strong: string
  accent: string
  accentSoft: string
  background: string
  surface: string
  border: string
  codeBg: string
  codeBorder: string
  codeText: string
  link: string
  linkRef: string
  quoteBg: string
  quoteBorder: string
  quoteText: string
  tableHeaderBg: string
  tableBorder: string
  tableText: string
  tableHeaderText: string
  zebra: string | null
  divider: string
}

export interface ThemeProfile {
  id: ThemeId
  name: string
  version: number
  description: string
  font: { body: string; heading: string; mono: string }
  sizes: {
    body: number
    list: number
    table: number
    tableSmall: number
    code: number
    small: number
  }
  colors: ThemeColors
  paragraph: {
    lineHeight: number
    letterSpacing: number
    gap: number
    align: 'left' | 'justify'
    firstLineIndentPx: number
  }
  headings: {
    levels: HeadingLevelStyle[]
    numbering: NumberingStyle
  }
  quote: {
    shape: QuoteShape
    bg: string
    border: string
    barWidth: number
    radius: number
    paddingY: number
    paddingX: number
    fontSize: number
    lineHeight: number
  }
  callout: {
    bg: string
    border: string
    titleColor: string
    barWidth: number
    radius: number
    paddingY: number
    paddingX: number
    titleSize: number
    warnBg: string
    warnBorder: string
    warnTitleColor: string
  }
  code: {
    inlineBg: string
    inlineBorder: string
    inlineColor: string
    inlineRadius: number
    inlinePaddingY: number
    inlinePaddingX: number
    blockBg: string
    blockBorder: string
    blockColor: string
    blockRadius: number
    blockPaddingY: number
    blockPaddingX: number
    blockLineHeight: number
    tabSize: number
  }
  table: {
    borderWidth: number
    cellPaddingY: number
    cellPaddingX: number
    headerBg: string
    headerColor: string
    headerStyle: HeaderStyle
    zebra: boolean
    lineHeight: number
  }
  list: {
    indentPx: number
    itemGap: number
    bulletLevels: readonly string[]
    orderedLevels: readonly string[]
  }
  divider: {
    form: DividerForm
    color: string
    thickness: number
    marginY: number
  }
  eyebrow: {
    size: number
    weight: number
    letterSpacing: number
    color: string
    marginBottom: number
  }
  linkRef: { size: number; color: string }
  footer: { size: number; color: string; borderColor: string }
  labels: { linkSection: string; footnoteSection: string }
  shiki: { theme: string }
}

export interface ThemeSummary {
  id: ThemeId
  name: string
  description: string
  accent: string
}
