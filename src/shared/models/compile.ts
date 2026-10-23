import type { Diagnostic } from './diagnostic'
import type { ThemeId } from './theme'

export type ListMode = 'native' | 'static'
export type TableFallback = 'none' | 'records'
export type CodeWrap = 'soft' | 'scroll'
export type MathMode = 'svg' | 'raw'
export type PreviewWidth = 320 | 375 | 430

export interface CompileOptions {
  includeTitle: boolean
  listMode: ListMode
  tableFallback: TableFallback
  codeWrap: CodeWrap
  firstLineIndent: boolean
  highlight: boolean
  mathMode: MathMode
}

export interface CompileRequest {
  docId: string
  revision: number
  themeId: ThemeId
  options: CompileOptions
}

export interface CompileMeta {
  title: string
  eyebrow?: string
  author?: string
  summary?: string
  notice?: string
}

export interface CompileResult {
  taskId: string
  docId: string
  revision: number
  snapshotId: string
  status: 'ok' | 'blocked'
  html: string
  plainText: string
  diagnostics: Diagnostic[]
  meta: CompileMeta
  stats: {
    chars: number
    placeholders: number
    reviewItems: number
    links: number
    footnotes: number
    codeBlocks: number
    tables: number
    images: number
  }
}

export const DEFAULT_COMPILE_OPTIONS: CompileOptions = {
  includeTitle: true,
  listMode: 'native',
  tableFallback: 'none',
  codeWrap: 'soft',
  firstLineIndent: false,
  highlight: true,
  mathMode: 'svg',
}
