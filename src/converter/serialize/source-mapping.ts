import { parseFragment } from 'parse5'
import type { MdNode } from '../pipeline/types'
import type { SourceTextMapping } from '@shared/inline-text-style'

/** Fail closed for synthesized/rewritten text rather than guessing its source occurrence. */
export function sourceTextMapping(source: string, node: MdNode): SourceTextMapping | undefined {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  const value = String(node.value ?? '')
  if (start === undefined || end === undefined || !value) return
  const raw = source.slice(start, end)
  if (raw === value) return { start, end }
  let decoded = ''
  const offsets: Array<number | null> = [start]
  for (let at = 0; at < raw.length;) {
    let text = raw[at], consumed = 1
    if (raw[at] === '\\' && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(raw[at + 1] ?? '')) {
      text = raw[at + 1]; consumed = 2
    } else if (raw[at] === '&') {
      const entity = /^&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][\da-zA-Z]*);/.exec(raw.slice(at))?.[0]
      if (entity) {
        const fragment = parseFragment(entity)
        const first = fragment.childNodes[0]
        if (first?.nodeName === '#text' && 'value' in first) { text = first.value; consumed = entity.length }
      }
    } else if (raw.slice(at, at + 2) === '\r\n') { text = '\n'; consumed = 2 }
    decoded += text
    for (let i = 1; i < text.length; i++) offsets.push(null)
    at += consumed
    offsets.push(start + at)
  }
  if (decoded === value) return { start, end, offsets }
}

/** Quote/list continuation prefixes are syntax, so map their visible lines independently. */
export function sourceTextPieces(source: string, node: MdNode): Array<{ value: string; source?: SourceTextMapping }> {
  const value = String(node.value ?? '')
  const mapping = sourceTextMapping(source, node)
  if (mapping) return [{ value, source: mapping }]
  if (!node.position || !value.includes('\n')) return [{ value }]
  const raw = source.slice(node.position.start.offset, node.position.end.offset)
  const rawLines = raw.split(/(\r?\n)/)
  const lines = value.split('\n')
  if (rawLines.length !== lines.length * 2 - 1) return [{ value }]
  const pieces: Array<{ value: string; source?: SourceTextMapping }> = []
  let at = node.position.start.offset
  for (let index = 0; index < lines.length; index++) {
    const rawLine = rawLines[index * 2]
    const prefix = index > 0 ? /^(?:[ \t]*>[ \t]?)*[ \t]*/.exec(rawLine)![0].length : 0
    const position = { start: { ...node.position.start, offset: at + prefix }, end: { ...node.position.end, offset: at + rawLine.length } }
    const part = sourceTextMapping(source, { type: 'text', value: lines[index], position })
    if (!part && lines[index]) return [{ value }]
    pieces.push({ value: lines[index], source: part })
    at += rawLine.length
    if (index < lines.length - 1) { pieces.push({ value: '\n' }); at += rawLines[index * 2 + 1].length }
  }
  return pieces
}
