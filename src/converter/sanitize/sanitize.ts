import { parseFragment, serialize } from 'parse5'
import type { ThemeProfile } from '@shared/models/theme'
import { filterStyle, normalizeFontFamily } from '../styles/css-guard'
import { SVG_ALLOWED_ATTRS, SVG_TAGS, isSafeSvgPaint } from '../html/svg-policy'
import { IMAGE_ALLOWED_ATTRS, isSafeImageSrc } from '@shared/image-policy'

export interface SanitizeReport {
  droppedTags: string[]
  droppedStyles: string[]
}

export interface SanitizeResult {
  html: string
  text: string
  report: SanitizeReport
}

const ALLOWED_TAGS = new Set([
  'section',
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'strong',
  'em',
  'del',
  'u',
  's',
  'code',
  'pre',
  'br',
  'hr',
  'sub',
  'sup',
  'img',
  ...SVG_TAGS,
])

const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'link',
  'meta',
  'iframe',
  'object',
  'embed',
  'picture',
  'video',
  'audio',
  'source',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'canvas',
  'template',
  'noscript',
  'title',
  'head',
  'base',
])

const UNWRAP = new Set([
  'div',
  'article',
  'main',
  'header',
  'footer',
  'nav',
  'aside',
  'figure',
  'figcaption',
  'details',
  'summary',
  'dl',
  'dt',
  'dd',
  'kbd',
  'samp',
  'var',
  'mark',
  'small',
  'big',
  'font',
  'center',
  'abbr',
  'cite',
  'q',
  'time',
  'address',
  'label',
])

interface AnyNode {
  nodeName: string
  tagName?: string
  value?: string
  attrs?: Array<{ name: string; value: string }>
  childNodes?: AnyNode[]
}

function fontSet(theme: ThemeProfile): Set<string> {
  return new Set(
    [theme.font.body, theme.font.heading, theme.font.mono].map((stack) => normalizeFontFamily(stack)),
  )
}

function filterAttrs(node: AnyNode, fonts: Set<string>, report: SanitizeReport): Array<{ name: string; value: string }> {
  const tagName = (node.tagName ?? '').toLowerCase()
  const isSvg = SVG_TAGS.has(tagName)
  const allowedSvgAttrs = isSvg ? SVG_ALLOWED_ATTRS[tagName] : null
  const result: Array<{ name: string; value: string }> = []

  for (const attr of node.attrs ?? []) {
    const nameLower = attr.name.toLowerCase()
    if (nameLower === 'style') {
      const filtered = filterStyle(attr.value, fonts)
      for (const dropped of filtered.dropped) {
        report.droppedStyles.push(`${tagName || '?'}:${dropped}`)
      }
      if (filtered.style) {
        result.push({ name: 'style', value: filtered.style })
      }
    } else if (allowedSvgAttrs && allowedSvgAttrs.has(nameLower)) {
      if ((nameLower === 'fill' || nameLower === 'stroke') && !isSafeSvgPaint(attr.value)) continue
      result.push(attr)
    } else if (tagName === 'img' && IMAGE_ALLOWED_ATTRS.has(nameLower)) {
      if (nameLower === 'src' && !isSafeImageSrc(attr.value)) continue
      if (nameLower === 'referrerpolicy' && attr.value !== 'no-referrer') continue
      result.push(attr)
    }
  }

  return result
}

function sanitizeChildren(parent: AnyNode, fonts: Set<string>, report: SanitizeReport): void {
  const next: AnyNode[] = []
  for (const child of parent.childNodes ?? []) {
    if (child.nodeName === '#comment') continue
    if (child.nodeName === '#text') {
      next.push(child)
      continue
    }
    const tag = (child.tagName ?? '').toLowerCase()
    if (!tag) {
      next.push(child)
      continue
    }
    if (DROP_WITH_CONTENT.has(tag)) {
      report.droppedTags.push(tag)
      continue
    }
    if (!ALLOWED_TAGS.has(tag) || UNWRAP.has(tag)) {
      sanitizeChildren(child, fonts, report)
      next.push(...(child.childNodes ?? []))
      continue
    }
    child.attrs = filterAttrs(child, fonts, report)
    sanitizeChildren(child, fonts, report)
    next.push(child)
  }
  parent.childNodes = next
}

function collectText(node: AnyNode, out: string[]): void {
  if (node.nodeName === '#text') {
    if (node.value) out.push(node.value)
    return
  }
  if ((node.tagName ?? '').toLowerCase() === 'br') out.push('\n')
  for (const child of node.childNodes ?? []) collectText(child, out)
}

export function sanitizeFragment(html: string, theme: ThemeProfile): SanitizeResult {
  const fragment = parseFragment(html) as unknown as AnyNode
  const report: SanitizeReport = { droppedTags: [], droppedStyles: [] }
  sanitizeChildren(fragment, fontSet(theme), report)
  const textParts: string[] = []
  collectText(fragment, textParts)
  return {
    html: serialize(fragment as never),
    text: textParts.join(''),
    report,
  }
}
