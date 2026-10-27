export const INLINE_FONT_SIZE_PRESETS = [
  { label: '12px (极小标注)', value: '12px' },
  { label: '14px (说明/引用)', value: '14px' },
  { label: '15px (推荐正文)', value: '15px' },
  { label: '16px (默认正文)', value: '16px' },
  { label: '17px (正文放大)', value: '17px' },
  { label: '18px (强调小标题)', value: '18px' },
  { label: '20px (中标题)', value: '20px' },
  { label: '24px (大标题)', value: '24px' },
] as const

/** Explicit selections may override theme text styles; document defaults stay unchanged. */
export interface InlineTextStyle {
  color?: string
  fontSize?: string
}

/** Only literal colors and valid font sizes are accepted from Markdown. */
export function parseInlineTextStyle(value: string): InlineTextStyle {
  const style: InlineTextStyle = {}
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon < 0) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const content = declaration.slice(colon + 1).trim()
    if (property === 'color' && /^#[\da-f]{6}$/i.test(content)) style.color = content.toLowerCase()
    if (property === 'font-size') {
      if (/^\d{2}px$/i.test(content)) {
        const num = parseInt(content, 10)
        if (num >= 10 && num <= 48) style.fontSize = `${num}px`
      }
    }
  }
  return style
}

export function serializeInlineTextStyle(style: InlineTextStyle): string {
  return [
    style.color ? `color:${style.color}` : '',
    style.fontSize ? `font-size:${style.fontSize}` : '',
  ].filter(Boolean).join(';')
}

export interface SourceTextMapping {
  start: number
  end: number
  /** Source boundaries for decoded entities/escapes. Null means an indivisible character. */
  offsets?: Array<number | null>
}

export interface SourceTextSelection {
  start: number
  end: number
  text: string
}

/** Edit each text leaf separately, keeping Markdown emphasis, links and block syntax intact. */
export function applyInlineTextStyle(source: string, ranges: SourceTextSelection[], requested: InlineTextStyle): string {
  const style = serializeInlineTextStyle(parseInlineTextStyle(serializeInlineTextStyle(requested)))
  if (!style || !ranges.length) return source
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  for (let i = 0; i < sorted.length; i++) {
    const range = sorted[i]
    if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end > source.length ||
        range.start >= range.end || source.slice(range.start, range.end) !== range.text || (i > 0 && sorted[i - 1].end > range.start)) {
      throw new Error('选区已失效，请重新选择文字。')
    }
  }
  let result = source
  for (const range of sorted.reverse()) {
    // Spans must stay within a Markdown line, especially in lists and blockquotes.
    const replacement = range.text.split(/(\r?\n)/).map(part => !part || /^\r?\n$/.test(part) ? part : `<span style="${style}">${part}</span>`).join('')
    result = result.slice(0, range.start) + replacement + result.slice(range.end)
  }
  return result
}
