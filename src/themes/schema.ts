import { z } from 'zod'
import type { ThemeProfile } from '@shared/models/theme'

const px = z.number().finite().min(0).max(240)
const hex = z.string().regex(/^#[0-9a-f]{6}$/i)
const ratio = z.number().finite().min(1).max(3)

const headingLevelSchema = z
  .object({
    size: px,
    marginTop: px,
    marginBottom: px,
    weight: z.number().int().min(100).max(900),
    lineHeight: ratio,
    align: z.enum(['left', 'center']),
    borderSide: z.enum(['bottom', 'left', 'top']).optional(),
    borderWidth: px.optional(),
    borderColor: hex.optional(),
    paddingBottom: px.optional(),
    paddingLeft: px.optional(),
    letterSpacing: z.number().finite().min(-5).max(20).optional(),
    color: hex.optional(),
  })
  .strict()

const colorsSchema = z
  .object({
    text: hex,
    textSecondary: hex,
    textMuted: hex,
    heading: hex,
    strong: hex,
    accent: hex,
    accentSoft: hex,
    background: hex,
    surface: hex,
    border: hex,
    codeBg: hex,
    codeBorder: hex,
    codeText: hex,
    link: hex,
    linkRef: hex,
    quoteBg: hex,
    quoteBorder: hex,
    quoteText: hex,
    tableHeaderBg: hex,
    tableBorder: hex,
    tableText: hex,
    tableHeaderText: hex,
    zebra: hex.nullable(),
    divider: hex,
  })
  .strict()

export const themeProfileSchema = z
  .object({
    id: z.enum([
      'ocean-blue',
      'graphite',
      'terracotta',
      'jade',
      'magazine',
      'amber',
      'violet',
      'ink',
    ]),
    name: z.string().min(1).max(32),
    version: z.number().int().min(1),
    description: z.string().min(1).max(200),
    font: z
      .object({ body: z.string().min(1), heading: z.string().min(1), mono: z.string().min(1) })
      .strict(),
    sizes: z
      .object({
        body: px,
        list: px,
        table: px,
        tableSmall: px,
        code: px,
        small: px,
      })
      .strict(),
    colors: colorsSchema,
    paragraph: z
      .object({
        lineHeight: ratio,
        letterSpacing: z.number().finite().min(0).max(10),
        gap: px,
        align: z.enum(['left', 'justify']),
        firstLineIndentPx: px,
      })
      .strict(),
    headings: z
      .object({
        levels: z.array(headingLevelSchema).length(6),
        numbering: z.enum(['none', 'h2-two-digit', 'h2-cn']),
      })
      .strict(),
    quote: z
      .object({
        shape: z.enum(['bar', 'panel']),
        bg: hex,
        border: hex,
        barWidth: px,
        radius: px,
        paddingY: px,
        paddingX: px,
        fontSize: px,
        lineHeight: ratio,
      })
      .strict(),
    callout: z
      .object({
        bg: hex,
        border: hex,
        titleColor: hex,
        barWidth: px,
        radius: px,
        paddingY: px,
        paddingX: px,
        titleSize: px,
        warnBg: hex,
        warnBorder: hex,
        warnTitleColor: hex,
      })
      .strict(),
    code: z
      .object({
        inlineBg: hex,
        inlineBorder: hex,
        inlineColor: hex,
        inlineRadius: px,
        inlinePaddingY: px,
        inlinePaddingX: px,
        blockBg: hex,
        blockBorder: hex,
        blockColor: hex,
        blockRadius: px,
        blockPaddingY: px,
        blockPaddingX: px,
        blockLineHeight: ratio,
        tabSize: z.number().int().min(1).max(8),
      })
      .strict(),
    table: z
      .object({
        borderWidth: px,
        cellPaddingY: px,
        cellPaddingX: px,
        headerBg: hex,
        headerColor: hex,
        headerStyle: z.enum(['all', 'rule']),
        zebra: z.boolean(),
        lineHeight: ratio,
      })
      .strict(),
    list: z
      .object({
        indentPx: px,
        itemGap: px,
        bulletLevels: z.array(z.string().min(1)).min(3).max(3),
        orderedLevels: z.array(z.string().min(1)).min(3).max(3),
      })
      .strict(),
    divider: z
      .object({
        form: z.enum(['block', 'line', 'dashed', 'dotted']),
        color: hex,
        thickness: px,
        marginY: px,
      })
      .strict(),
    eyebrow: z
      .object({
        size: px,
        weight: z.number().int().min(100).max(900),
        letterSpacing: z.number().finite().min(0).max(10),
        color: hex,
        marginBottom: px,
      })
      .strict(),
    linkRef: z.object({ size: px, color: hex }).strict(),
    footer: z.object({ size: px, color: hex, borderColor: hex }).strict(),
    labels: z.object({ linkSection: z.string().min(1), footnoteSection: z.string().min(1) }).strict(),
    shiki: z.object({ theme: z.string().min(1) }).strict(),
  })
  .strict()

export function parseTheme(raw: unknown): ThemeProfile {
  return themeProfileSchema.parse(raw) as ThemeProfile
}

export function allowedFontSizes(theme: ThemeProfile): Set<number> {
  const sizes = new Set<number>([
    theme.sizes.body,
    theme.sizes.list,
    theme.sizes.table,
    theme.sizes.tableSmall,
    theme.sizes.code,
    theme.sizes.small,
    theme.quote.fontSize,
    theme.callout.titleSize,
    theme.eyebrow.size,
    theme.linkRef.size,
    theme.footer.size,
  ])
  for (const level of theme.headings.levels) sizes.add(level.size)
  return sizes
}

export function allowedColors(theme: ThemeProfile): Set<string> {
  const colors = new Set<string>()
  for (const value of Object.values(theme.colors)) {
    if (typeof value === 'string') colors.add(value.toLowerCase())
  }
  colors.add(theme.quote.bg.toLowerCase())
  colors.add(theme.quote.border.toLowerCase())
  colors.add(theme.callout.bg.toLowerCase())
  colors.add(theme.callout.border.toLowerCase())
  colors.add(theme.callout.titleColor.toLowerCase())
  colors.add(theme.callout.warnBg.toLowerCase())
  colors.add(theme.callout.warnBorder.toLowerCase())
  colors.add(theme.callout.warnTitleColor.toLowerCase())
  colors.add(theme.code.inlineBg.toLowerCase())
  colors.add(theme.code.inlineBorder.toLowerCase())
  colors.add(theme.code.inlineColor.toLowerCase())
  colors.add(theme.code.blockBg.toLowerCase())
  colors.add(theme.code.blockBorder.toLowerCase())
  colors.add(theme.code.blockColor.toLowerCase())
  colors.add(theme.table.headerBg.toLowerCase())
  colors.add(theme.table.headerColor.toLowerCase())
  colors.add(theme.divider.color.toLowerCase())
  colors.add(theme.eyebrow.color.toLowerCase())
  colors.add(theme.linkRef.color.toLowerCase())
  colors.add(theme.footer.color.toLowerCase())
  colors.add(theme.footer.borderColor.toLowerCase())
  for (const level of theme.headings.levels) {
    if (level.borderColor) colors.add(level.borderColor.toLowerCase())
    if (level.color) colors.add(level.color.toLowerCase())
  }
  return colors
}
