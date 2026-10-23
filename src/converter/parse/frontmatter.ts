import type { CompileMeta } from '@shared/models/compile'
import type { MdNode } from '../pipeline/types'
import { childrenOf } from '../pipeline/ast'
import type { DiagnosticSink } from '../pipeline/types'

const ALLOWED_KEYS = new Set([
  'title',
  'author',
  'summary',
  'date',
  'tags',
  'slug',
  'eyebrow',
  'notice',
])

function unquote(raw: string): string {
  const value = raw.trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'")
  }
  return value
}

export interface FrontMatterResult {
  root: MdNode
  meta: CompileMeta
}

export function splitFrontMatter(root: MdNode, diagnostics: DiagnosticSink): FrontMatterResult {
  const meta: CompileMeta = { title: '' }
  const kept: MdNode[] = []

  for (const child of childrenOf(root)) {
    if (child.type !== 'yaml') {
      kept.push(child)
      continue
    }
    const lines = String(child.value ?? '').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf(':')
      if (separator <= 0) continue
      const key = trimmed.slice(0, separator).trim()
      const value = unquote(trimmed.slice(separator + 1))
      if (!ALLOWED_KEYS.has(key)) {
        diagnostics.push({
          code: 'frontmatter.ignored-key',
          severity: 'info',
          message: `文章头部属性（Front Matter）中的「${key}」未在此排版主题中使用，已跳过。`,
          action: '不影响正文转换，已支持字段包括标题、作者、摘要、日期、标签、眉标与导语。',
          review: false,
          span: undefined,
        })
        continue
      }
      if (value === '') continue
      if (key === 'title') meta.title = value
      else if (key === 'author') meta.author = value
      else if (key === 'summary') meta.summary = value
      else if (key === 'eyebrow') meta.eyebrow = value
      else if (key === 'notice') meta.notice = value
    }
  }

  root.children = kept
  return { root, meta }
}
