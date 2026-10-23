import * as csstree from 'css-tree'

/** Static geometry and text needed by MathJax; no scripts or external references. */
export const SVG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  svg: new Set(['xmlns', 'viewbox', 'width', 'height', 'style', 'role', 'focusable', 'aria-hidden']),
  g: new Set(['transform', 'stroke', 'fill', 'stroke-width', 'data-mml-node', 'style']),
  path: new Set(['d', 'data-c', 'fill', 'stroke', 'style', 'stroke-width', 'transform']),
  rect: new Set(['x', 'y', 'width', 'height', 'fill', 'stroke', 'transform', 'style']),
  circle: new Set(['cx', 'cy', 'r', 'fill', 'stroke', 'style']),
  line: new Set(['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'style']),
  polyline: new Set(['points', 'stroke', 'fill', 'stroke-width', 'style']),
  polygon: new Set(['points', 'stroke', 'fill', 'stroke-width', 'style']),
  text: new Set(['x', 'y', 'dx', 'dy', 'transform', 'font-size', 'font-family', 'font-style', 'font-weight', 'fill', 'stroke', 'style']),
}

export const SVG_TAGS = new Set(Object.keys(SVG_ALLOWED_ATTRS))

export function isSafeSvgPaint(value: string): boolean {
  const paint = value.trim()
  if (/^(?:none|currentcolor)$/i.test(paint)) return true
  // Restrict to literal colors before grammar validation; no URL, var(), or escapes.
  if (!/^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgba?|hsla?)\([\d\s.,%+/-]+\))$/i.test(paint)) return false
  return csstree.lexer.matchProperty('color', paint).matched !== null
}
