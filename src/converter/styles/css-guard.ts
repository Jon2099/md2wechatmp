import * as csstree from 'css-tree'

const ALLOWED_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-indent',
  'text-decoration',
  'text-transform',
  'vertical-align',
  'white-space',
  'word-break',
  'overflow-wrap',
  'width',
  'max-width',
  'height',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'border-collapse',
  'box-sizing',
  'list-style-type',
  'list-style-position',
  'overflow',
  'display',
  'justify-content',
])

const COLOR_PROPERTIES = new Set(['color', 'background-color'])
const LENGTH_PROPERTIES = new Set([
  'font-size',
  'letter-spacing',
  'text-indent',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-radius',
])
const BORDER_PROPERTIES = new Set(['border', 'border-top', 'border-right', 'border-bottom', 'border-left'])

const ENUMS: Record<string, Set<string>> = {
  'text-align': new Set(['left', 'right', 'center', 'justify']),
  'vertical-align': new Set(['top', 'middle', 'bottom', 'baseline', 'super', 'sub', 'text-top', 'text-bottom']),
  'white-space': new Set(['normal', 'pre', 'pre-wrap', 'nowrap']),
  'word-break': new Set(['normal', 'break-word', 'break-all', 'keep-all']),
  'overflow-wrap': new Set(['normal', 'break-word', 'anywhere']),
  overflow: new Set(['hidden', 'auto', 'visible']),
  'box-sizing': new Set(['border-box', 'content-box']),
  'border-collapse': new Set(['collapse', 'separate']),
  'list-style-position': new Set(['inside', 'outside']),
  'list-style-type': new Set([
    'disc',
    'circle',
    'square',
    'decimal',
    'lower-alpha',
    'lower-roman',
    'none',
  ]),
  'text-decoration': new Set(['none', 'underline', 'line-through', 'overline']),
  'text-transform': new Set(['none', 'uppercase', 'lowercase', 'capitalize']),
  'font-style': new Set(['normal', 'italic', 'oblique']),
  display: new Set(['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'none']),
  'justify-content': new Set(['center', 'flex-start', 'flex-end', 'space-between', 'space-around']),
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i
const PX_VALUE = /^-?\d+(\.\d+)?px$/
const NUMBER_VALUE = /^-?\d+(\.\d+)?$/
const BORDER_VALUE = /^(\d+(\.\d+)?px) (solid|dashed|dotted) (#[0-9a-f]{3,8})$/i

export interface StyleFilterResult {
  style: string
  dropped: string[]
}

export function normalizeFontFamily(value: string): string {
  return value
    .replace(/["']/g, '')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isValidValue(property: string, value: string, fonts: Set<string>): boolean {
  const normalized = value.trim()
  if (!normalized) return false
  if (/url\s*\(|expression|javascript:|var\s*\(|@import|!important/i.test(normalized)) return false

  if (COLOR_PROPERTIES.has(property)) return HEX_COLOR.test(normalized)
  if (property === 'font-family') return fonts.has(normalizeFontFamily(normalized))
  if (property === 'font-size') return PX_VALUE.test(normalized)
  if (LENGTH_PROPERTIES.has(property)) {
    if (property === 'border-radius') {
      return normalized.split(/\s+/).every((part) => PX_VALUE.test(part) || part === '0')
    }
    return PX_VALUE.test(normalized) || normalized === '0'
  }
  if (BORDER_PROPERTIES.has(property)) return BORDER_VALUE.test(normalized)
  if (property === 'line-height') return NUMBER_VALUE.test(normalized) || PX_VALUE.test(normalized)
  if (property === 'letter-spacing') return PX_VALUE.test(normalized)
  if (property === 'vertical-align') {
    if (ENUMS['vertical-align'].has(normalized)) return true
    if (/^-?\d+(\.\d+)?(ex|em|px|%)$/.test(normalized)) return true
    return false
  }
  if (property === 'font-weight') return /^([1-9]00|normal|bold)$/.test(normalized)
  if (property === 'width' || property === 'max-width') {
    return normalized === '100%' || /^\d+(\.\d+)?(ex|em|px|%)$/.test(normalized)
  }
  if (property === 'height') {
    return normalized === 'auto' || normalized === '0' || normalized === '1px' || /^\d+(\.\d+)?(ex|em|px|%)$/.test(normalized)
  }
  const enumSet = ENUMS[property]
  if (enumSet) return enumSet.has(normalized)
  return false
}

export function filterStyle(
  style: string,
  fonts: Set<string>,
): StyleFilterResult {
  const dropped: string[] = []
  const kept: string[] = []
  let declarations: Array<{ property: string; value: string }> = []

  try {
    const ast = csstree.parse(style, { context: 'declarationList' }) as unknown as {
      children?: { toArray: () => Array<{ type: string; property?: string; value?: unknown }> }
    }
    declarations = (ast.children?.toArray() ?? []).map((node) => ({
      property: String(node.property ?? '').toLowerCase(),
      value: node.value ? csstree.generate(node.value as never) : '',
    }))
  } catch {
    return { style: '', dropped: [style] }
  }

  for (const declaration of declarations) {
    const property = declaration.property
    const value = declaration.value.replace(/\s+/g, ' ').trim()
    if (!ALLOWED_PROPERTIES.has(property)) {
      dropped.push(`${property}:${value}`)
      continue
    }
    if (!isValidValue(property, value, fonts)) {
      dropped.push(`${property}:${value}`)
      continue
    }
    kept.push(`${property}:${value}`)
  }

  return { style: kept.join(';'), dropped }
}
