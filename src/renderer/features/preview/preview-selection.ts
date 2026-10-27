import type { SourceTextMapping, SourceTextSelection } from '@shared/inline-text-style'

export interface PreviewSelection {
  ranges: SourceTextSelection[]
  rect: DOMRect
  color: string
}

export function readPreviewSelection(doc: Document, source: string): PreviewSelection | null {
  const selection = doc.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount || !selection.toString().trim()) return null
  const range = selection.getRangeAt(0)
  const article = doc.getElementById('preview-phone')
  if (!article?.contains(range.commonAncestorContainer)) return null
  const walker = doc.createTreeWalker(article, 4 /* SHOW_TEXT */)
  const ranges: SourceTextSelection[] = []
  let first: Element | null = null
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!range.intersectsNode(node)) continue
    const text = node.textContent ?? ''
    const from = node === range.startContainer ? range.startOffset : 0
    const to = node === range.endContainer ? range.endOffset : text.length
    if (from >= to || !text.slice(from, to).trim()) continue
    const wrapper = node.parentElement?.closest('[data-md2w-source]')
    if (!wrapper || node.parentElement !== wrapper || wrapper.closest('pre,code,svg,.preview-video-block')) return null
    let mapping: SourceTextMapping
    try { mapping = JSON.parse(wrapper.getAttribute('data-md2w-source') ?? '') } catch { return null }
    const start = mapping.offsets ? mapping.offsets[from] : mapping.start + from
    const end = mapping.offsets ? mapping.offsets[to] : mapping.start + to
    if (start == null || end == null || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > source.length || start >= end) return null
    const chunk = { start, end, text: source.slice(start, end) }
    // Rendering the same source twice (e.g. references) must not produce overlapping edits.
    if (ranges.some(item => item.start < end && item.end > start)) return null
    ranges.push(chunk)
    first ??= wrapper
  }
  if (!ranges.length || !first) return null
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return null
  const rgb = doc.defaultView?.getComputedStyle(first).color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  const color = rgb ? '#' + rgb.slice(1).map(value => Number(value).toString(16).padStart(2, '0')).join('') : '#2d2d2d'
  return { ranges, rect, color }
}
