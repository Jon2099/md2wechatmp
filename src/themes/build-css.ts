import type { CompileOptions } from '@shared/models/compile'
import type { ThemeProfile } from '@shared/models/theme'
import { ROLES, olRole, ulRole } from '@shared/roles'

type DeclValue = string | number | null | undefined | false
type Decls = Record<string, DeclValue>

export interface ThemeCss {
  css: string
  classes: Set<string>
}

const px = (value: number): string => (value === 0 ? '0' : `${value}px`)

function rule(selector: string, decls: Decls): string {
  const body = Object.entries(decls)
    .filter(([, value]) => value !== null && value !== undefined && value !== false && value !== '')
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
  return body ? `${selector}{${body}}` : ''
}

function border(_side: 'bottom' | 'left' | 'top', width: number, color: string, style = 'solid'): string {
  return `${width}px ${style} ${color}`
}

export function buildThemeCss(theme: ThemeProfile, options: CompileOptions): ThemeCss {
  const c = theme.colors
  const gap = px(theme.paragraph.gap)
  const rules: string[] = []
  rules.push(rule(`.${ROLES.image}`, {
    display: 'inline-block', 'max-width': '100%', height: 'auto', 'vertical-align': 'middle',
  }))

  rules.push(
    rule(`.${ROLES.root}`, {
      'font-family': theme.font.body,
      'font-size': px(theme.sizes.body),
      'line-height': theme.paragraph.lineHeight,
      'letter-spacing': px(theme.paragraph.letterSpacing),
      color: c.text,
      'background-color': c.background,
      'text-align': theme.paragraph.align,
      'word-break': 'break-word',
      'overflow-wrap': 'break-word',
    }),
  )

  rules.push(
    rule(`.${ROLES.eyebrow}`, {
      'font-family': theme.font.heading,
      'font-size': px(theme.eyebrow.size),
      'font-weight': theme.eyebrow.weight,
      'letter-spacing': px(theme.eyebrow.letterSpacing),
      color: theme.eyebrow.color,
      'text-align': theme.headings.levels[0]?.align ?? 'left',
      'line-height': 1.6,
      'margin-top': 0,
      'margin-bottom': px(theme.eyebrow.marginBottom),
    }),
  )

  theme.headings.levels.forEach((level, index) => {
    const role = [ROLES.h1, ROLES.h2, ROLES.h3, ROLES.h4, ROLES.h5, ROLES.h6][index]
    const decls: Decls = {
      'font-family': theme.font.heading,
      'font-size': px(level.size),
      'font-weight': level.weight,
      'line-height': level.lineHeight,
      color: level.color ?? c.heading,
      'text-align': level.align,
      'letter-spacing': level.letterSpacing === undefined ? px(theme.paragraph.letterSpacing) : px(level.letterSpacing),
      'margin-top': px(level.marginTop),
      'margin-bottom': px(level.marginBottom),
    }
    if (level.borderSide && level.borderWidth) {
      const color = level.borderColor ?? c.accent
      decls[`border-${level.borderSide}`] = border(level.borderSide, level.borderWidth, color)
      if (level.borderSide === 'bottom' && level.paddingBottom !== undefined) {
        decls['padding-bottom'] = px(level.paddingBottom)
      }
      if (level.borderSide === 'left' && level.paddingLeft !== undefined) {
        decls['padding-left'] = px(level.paddingLeft)
      }
    }
    rules.push(rule(`.${role}`, decls))
  })

  rules.push(
    rule(`.${ROLES.p}`, {
      'font-size': px(theme.sizes.body),
      'line-height': theme.paragraph.lineHeight,
      'letter-spacing': px(theme.paragraph.letterSpacing),
      color: c.text,
      'text-align': theme.paragraph.align,
      'margin-top': 0,
      'margin-bottom': gap,
      'text-indent':
        options.firstLineIndent && theme.paragraph.firstLineIndentPx > 0
          ? px(theme.paragraph.firstLineIndentPx)
          : null,
    }),
  )

  rules.push(rule('strong', { 'font-weight': 700, color: c.strong }))
  rules.push(rule('em', { 'font-style': 'italic' }))
  rules.push(rule('del', { 'text-decoration': 'line-through', color: c.textMuted }))
  rules.push(rule('sub', { 'vertical-align': 'sub', 'font-size': px(theme.sizes.small) }))
  rules.push(rule('sup', { 'vertical-align': 'super', 'font-size': px(theme.sizes.small) }))
  rules.push(rule('u', { 'text-decoration': 'underline' }))

  const quoteDecls: Decls = {
    'font-size': px(theme.quote.fontSize),
    'line-height': theme.quote.lineHeight,
    color: c.quoteText,
    'background-color': theme.quote.bg,
    'text-align': 'left',
    'margin-top': 0,
    'margin-bottom': gap,
  }
  if (theme.quote.shape === 'bar') {
    quoteDecls['border-left'] = border('left', theme.quote.barWidth, theme.quote.border)
    quoteDecls['border-radius'] = `0 ${px(theme.quote.radius)} ${px(theme.quote.radius)} 0`
  } else {
    quoteDecls['border'] = `1px solid ${theme.quote.border}`
    quoteDecls['border-left'] = border('left', theme.quote.barWidth, theme.quote.border)
    quoteDecls['border-radius'] = px(theme.quote.radius)
  }
  quoteDecls['padding-top'] = px(theme.quote.paddingY)
  quoteDecls['padding-bottom'] = px(theme.quote.paddingY)
  quoteDecls['padding-left'] = px(theme.quote.paddingX)
  quoteDecls['padding-right'] = px(theme.quote.paddingX)
  rules.push(rule(`.${ROLES.quote}`, quoteDecls))

  rules.push(
    rule(`.${ROLES.callout}`, {
      'background-color': theme.callout.bg,
      border: `1px solid ${theme.callout.border}`,
      'border-left': border('left', theme.callout.barWidth, c.accent),
      'border-radius': px(theme.callout.radius),
      'padding-top': px(theme.callout.paddingY),
      'padding-bottom': px(theme.callout.paddingY),
      'padding-left': px(theme.callout.paddingX),
      'padding-right': px(theme.callout.paddingX),
      'margin-top': 0,
      'margin-bottom': gap,
      'text-align': 'left',
    }),
  )
  rules.push(
    rule(`.${ROLES.calloutWarn}`, {
      'background-color': theme.callout.warnBg,
      border: `1px solid ${theme.callout.warnBorder}`,
      'border-left': border('left', theme.callout.barWidth, theme.callout.warnTitleColor),
    }),
  )
  rules.push(
    rule(`.${ROLES.calloutTitle}`, {
      'font-family': theme.font.heading,
      'font-size': px(theme.callout.titleSize),
      'font-weight': 700,
      color: theme.callout.titleColor,
      'line-height': 1.6,
      'text-align': 'left',
      'margin-top': 0,
      'margin-bottom': 10,
    }),
  )
  rules.push(
    rule(`.${ROLES.calloutWarn} .${ROLES.calloutTitle}`, {
      color: theme.callout.warnTitleColor,
    }),
  )

  rules.push(
    rule(`.${ROLES.list}`, {
      'margin-top': 0,
      'margin-bottom': gap,
      'padding-left': px(theme.list.indentPx),
      'list-style-position': 'outside',
    }),
  )
  rules.push(
    rule(`.${ROLES.callout} .${ROLES.list}`, {
      'margin-top': 0,
      'margin-bottom': 0,
      'padding-left': px(18),
    }),
  )
  rules.push(
    rule(`.${ROLES.quote} .${ROLES.list}`, {
      'margin-top': 0,
      'margin-bottom': 0,
      'padding-left': px(18),
    }),
  )
  rules.push(
    rule(`.${ROLES.callout} .${ROLES.li}:last-child`, {
      'margin-bottom': 0,
    }),
  )
  rules.push(
    rule(`.${ROLES.quote} .${ROLES.li}:last-child`, {
      'margin-bottom': 0,
    }),
  )
  rules.push(
    rule(`.${ROLES.callout} > .${ROLES.p}:last-child`, {
      'margin-bottom': 0,
    }),
  )
  rules.push(
    rule(`.${ROLES.quote} > .${ROLES.p}:last-child`, {
      'margin-bottom': 0,
    }),
  )
  ;[1, 2, 3].forEach((depth) => {
    rules.push(rule(`.${ulRole(depth)}`, { 'list-style-type': theme.list.bulletLevels[depth - 1] }))
    rules.push(rule(`.${olRole(depth)}`, { 'list-style-type': theme.list.orderedLevels[depth - 1] }))
  })
  rules.push(
    rule(`.${ROLES.listNone}`, {
      'list-style-type': 'none',
      'padding-left': 0,
    }),
  )
  rules.push(
    rule(`.${ROLES.li}`, {
      'font-size': px(theme.sizes.list),
      'line-height': theme.paragraph.lineHeight,
      color: c.text,
      'text-align': 'left',
      'margin-top': 0,
      'margin-bottom': px(theme.list.itemGap),
    }),
  )

  rules.push(
    rule(`.${ROLES.code}`, {
      'font-family': theme.font.mono,
      'font-size': px(theme.sizes.code),
      color: theme.code.inlineColor,
      'background-color': theme.code.inlineBg,
      border: `1px solid ${theme.code.inlineBorder}`,
      'border-radius': px(theme.code.inlineRadius),
      'padding-top': px(theme.code.inlinePaddingY),
      'padding-bottom': px(theme.code.inlinePaddingY),
      'padding-left': px(theme.code.inlinePaddingX),
      'padding-right': px(theme.code.inlinePaddingX),
      'word-break': 'normal',
      'overflow-wrap': 'break-word',
    }),
  )

  const preDecls: Decls = {
    'font-family': theme.font.mono,
    'font-size': px(theme.sizes.code),
    color: theme.code.blockColor,
    'background-color': theme.code.blockBg,
    border: `1px solid ${theme.code.blockBorder}`,
    'border-radius': px(theme.code.blockRadius),
    'padding-top': px(theme.code.blockPaddingY),
    'padding-bottom': px(theme.code.blockPaddingY),
    'padding-left': px(theme.code.blockPaddingX),
    'padding-right': px(theme.code.blockPaddingX),
    'line-height': theme.code.blockLineHeight,
    'text-align': 'left',
    'margin-top': 0,
    'margin-bottom': gap,
    'white-space': options.codeWrap === 'scroll' ? 'pre' : 'pre-wrap',
    'word-break': options.codeWrap === 'scroll' ? 'normal' : 'break-word',
    'overflow-wrap': options.codeWrap === 'scroll' ? 'normal' : 'break-word',
    overflow: options.codeWrap === 'scroll' ? 'auto' : 'hidden',
  }
  rules.push(rule(`.${ROLES.pre}`, preDecls))
  rules.push(
    rule(`.${ROLES.codeBlock}`, {
      'font-family': theme.font.mono,
      'font-size': px(theme.sizes.code),
      color: theme.code.blockColor,
      'line-height': theme.code.blockLineHeight,
      'white-space': options.codeWrap === 'scroll' ? 'pre' : 'pre-wrap',
      'word-break': options.codeWrap === 'scroll' ? 'normal' : 'break-word',
    }),
  )

  rules.push(
    rule(`.${ROLES.table}`, {
      width: '100%',
      'border-collapse': 'collapse',
      'margin-top': 0,
      'margin-bottom': gap,
      'font-size': px(theme.sizes.table),
    }),
  )
  const cellBase: Decls = {
    'text-align': 'left',
    'vertical-align': 'top',
    'box-sizing': 'border-box',
    'word-break': 'break-word',
    'overflow-wrap': 'break-word',
    'line-height': theme.table.lineHeight,
    'padding-top': px(theme.table.cellPaddingY),
    'padding-bottom': px(theme.table.cellPaddingY),
    'padding-left': px(theme.table.cellPaddingX),
    'padding-right': px(theme.table.cellPaddingX),
    'font-size': px(theme.sizes.table),
  }
  const headerBorder =
    theme.table.headerStyle === 'all' ? `1px solid ${c.tableBorder}` : null
  rules.push(
    rule(`.${ROLES.th}`, {
      ...cellBase,
      border: headerBorder,
      'border-bottom': border(
        'bottom',
        theme.table.headerStyle === 'all' ? theme.table.borderWidth : 1,
        theme.table.headerStyle === 'all' ? c.tableBorder : c.heading,
      ),
      'background-color': theme.table.headerStyle === 'all' ? theme.table.headerBg : null,
      color: theme.table.headerColor,
      'font-weight': 700,
    }),
  )
  const bodyBorder =
    theme.table.headerStyle === 'all' ? `1px solid ${c.tableBorder}` : null
  rules.push(
    rule(`.${ROLES.td}`, {
      ...cellBase,
      border: bodyBorder,
      'border-bottom': `1px solid ${theme.table.headerStyle === 'all' ? c.tableBorder : c.border}`,
      color: c.tableText,
    }),
  )
  if (theme.table.zebra && c.zebra) {
    rules.push(rule(`.${ROLES.zebra}`, { 'background-color': c.zebra }))
  }
  rules.push(rule(`.${ROLES.tableCompact}`, { 'font-size': px(theme.sizes.tableSmall) }))
  rules.push(
    rule(`.${ROLES.tableCompact} .${ROLES.th}`, {
      'font-size': px(theme.sizes.tableSmall),
      'padding-top': px(Math.max(theme.table.cellPaddingY - 2, 4)),
      'padding-bottom': px(Math.max(theme.table.cellPaddingY - 2, 4)),
      'padding-left': px(Math.max(theme.table.cellPaddingX - 2, 3)),
      'padding-right': px(Math.max(theme.table.cellPaddingX - 2, 3)),
      'line-height': 1.55,
    }),
  )
  rules.push(
    rule(`.${ROLES.tableCompact} .${ROLES.td}`, {
      'font-size': px(theme.sizes.tableSmall),
      'padding-top': px(Math.max(theme.table.cellPaddingY - 2, 4)),
      'padding-bottom': px(Math.max(theme.table.cellPaddingY - 2, 4)),
      'padding-left': px(Math.max(theme.table.cellPaddingX - 2, 3)),
      'padding-right': px(Math.max(theme.table.cellPaddingX - 2, 3)),
      'line-height': 1.55,
    }),
  )

  const dividerDecls: Decls = {
    'margin-top': px(theme.divider.marginY),
    'margin-bottom': px(theme.divider.marginY),
    'line-height': px(1),
    'font-size': px(1),
    overflow: 'hidden',
  }
  if (theme.divider.form === 'block') {
    dividerDecls.height = px(theme.divider.thickness)
    dividerDecls['background-color'] = theme.divider.color
  } else {
    dividerDecls.height = px(0)
    const style =
      theme.divider.form === 'dashed' ? 'dashed' : theme.divider.form === 'dotted' ? 'dotted' : 'solid'
    dividerDecls['border-top'] = border('top', theme.divider.thickness, theme.divider.color, style)
  }
  rules.push(rule(`.${ROLES.divider}`, dividerDecls))

  rules.push(
    rule(`.${ROLES.link}`, {
      color: c.link,
      'text-decoration': 'underline',
      'word-break': 'break-word',
    }),
  )
  rules.push(
    rule(`.${ROLES.linkRef}`, {
      'font-size': px(theme.linkRef.size),
      color: theme.linkRef.color,
      'text-decoration': 'none',
      'margin-left': px(2),
      'word-break': 'break-word',
    }),
  )
  rules.push(
    rule(`.${ROLES.fnRef}`, {
      'font-size': px(theme.sizes.small),
      color: theme.linkRef.color,
      'vertical-align': 'super',
      'line-height': 1,
      'text-decoration': 'none',
    }),
  )
  rules.push(
    rule(`.${ROLES.sectionTitle}`, {
      'font-family': theme.font.heading,
      'font-size': px(theme.headings.levels[2]?.size ?? theme.sizes.body),
      'font-weight': 700,
      color: c.heading,
      'line-height': 1.5,
      'text-align': 'left',
      'margin-top': px(28),
      'margin-bottom': px(12),
      'padding-top': px(12),
      'border-top': `1px solid ${c.border}`,
    }),
  )
  rules.push(
    rule(`.${ROLES.links}`, { 'margin-top': 0, 'margin-bottom': px(8) }),
  )
  rules.push(
    rule(`.${ROLES.footnotes}`, { 'margin-top': 0, 'margin-bottom': px(8) }),
  )
  rules.push(
    rule(`.${ROLES.footnoteItem}`, {
      'font-size': px(theme.footer.size),
      'line-height': 1.7,
      color: c.textSecondary,
      'margin-top': 0,
      'margin-bottom': px(6),
      'text-align': 'left',
      'word-break': 'break-word',
    }),
  )
  rules.push(
    rule(`.${ROLES.math}`, {
      'font-family': theme.font.mono,
      'font-size': px(theme.sizes.code),
      color: c.codeText,
      'background-color': c.codeBg,
      'padding-left': px(4),
      'padding-right': px(4),
      'border-radius': px(2),
    }),
  )
  rules.push(
    rule(`.${ROLES.mathBlock}`, {
      'font-family': theme.font.mono,
      'font-size': px(theme.sizes.code),
      color: c.codeText,
      'white-space': 'pre-wrap',
      'word-break': 'break-word',
    }),
  )
  rules.push(
    rule(`.${ROLES.mathSvg}`, {
      'display': 'inline-block',
      'vertical-align': 'middle',
      'line-height': '0',
    }),
  )
  rules.push(
    rule(`.${ROLES.mathBlockSvg}`, {
      'display': 'block',
      'text-align': 'center',
      'margin-top': px(16),
      'margin-bottom': px(16),
      'overflow': 'auto',
    }),
  )
  rules.push(
    rule(`.${ROLES.notice}`, {
      'font-size': px(theme.footer.size),
      'line-height': 1.7,
      color: c.textSecondary,
      'background-color': c.surface,
      border: `1px solid ${c.border}`,
      'border-radius': px(theme.quote.radius),
      'padding-top': px(10),
      'padding-bottom': px(10),
      'padding-left': px(12),
      'padding-right': px(12),
      'margin-top': 0,
      'margin-bottom': gap,
    }),
  )

  const css = rules.filter(Boolean).join('\n')
  const classes = new Set<string>()
  for (const match of css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
    classes.add(match[1])
  }
  return { css, classes }
}

const FORBIDDEN_CSS = [
  { pattern: /var\s*\(/i, reason: 'CSS 变量' },
  { pattern: /calc\s*\(/i, reason: 'calc()' },
  { pattern: /::/, reason: '伪元素' },
  { pattern: /@media/i, reason: '@media' },
  { pattern: /@import/i, reason: '@import' },
  { pattern: /url\s*\(/i, reason: 'url()' },
  { pattern: /!important/i, reason: '!important' },
  { pattern: /(?:^|[^\w.-])\d+(?:\.\d+)?(?:em|rem|vw|vh)\b/i, reason: '相对单位' },
]

export function findForbiddenCss(css: string): string[] {
  return FORBIDDEN_CSS.filter((item) => item.pattern.test(css)).map((item) => item.reason)
}

export function assertSafeCss(css: string): void {
  const found = findForbiddenCss(css)
  if (found.length > 0) {
    throw new Error(`主题 CSS 含被禁止的写法：${found.join('、')}`)
  }
}
