import type { CompileMeta, CompileOptions } from '@shared/models/compile'
import type { Diagnostic, DiagnosticSummary, SourceSpan } from '@shared/models/diagnostic'
import type { FootnoteRecord, LinkRecord, PlaceholderRecord } from '@shared/models/snapshot'
import type { ThemeProfile } from '@shared/models/theme'

export interface MdPosition {
  start: { line: number; column: number; offset: number }
  end: { line: number; column: number; offset: number }
}

export interface MdNode {
  type: string
  value?: string
  depth?: number
  ordered?: boolean
  start?: number | null
  checked?: boolean | null
  spread?: boolean
  align?: Array<'left' | 'right' | 'center' | null>
  lang?: string | null
  meta?: string | null
  url?: string
  title?: string | null
  alt?: string | null
  identifier?: string
  label?: string
  /** 提示块标题：任务结构里保存为内联节点，而不是字符串 */
  wxTitle?: MdNode[]
  children?: MdNode[]
  data?: Record<string, unknown>
  position?: MdPosition
  [key: string]: unknown
}

export interface CompileLimits {
  maxChars: number
  maxBytes: number
  maxCodeBlocks: number
  maxImages: number
  maxTableColumns: number
  maxDiagnostics: number
}

export const DEFAULT_LIMITS: CompileLimits = {
  maxChars: 1_000_000,
  maxBytes: 4 * 1024 * 1024,
  maxCodeBlocks: 400,
  maxImages: 500,
  maxTableColumns: 12,
  maxDiagnostics: 200,
}

export interface CompileInput {
  baseDir?: string
  docId: string
  revision: number
  markdown: string
  theme: ThemeProfile
  options: CompileOptions
  signal?: AbortSignal
}

export interface ValidateStageOutput {
  source: string
  sourceHash: string
}

export interface ParseStageOutput {
  root: MdNode
}

export interface ArticleStageOutput {
  root: MdNode
  meta: CompileMeta
}

export interface DiagnosticSink {
  push(diagnostic: Omit<Diagnostic, 'id'>): void
  list(): Diagnostic[]
  summary(): DiagnosticSummary
  countBySeverity(severity: Diagnostic['severity']): number
}

export interface CompileContext {
  baseDir?: string
  docId: string
  revision: number
  source: string
  sourceHash: string
  theme: ThemeProfile
  options: CompileOptions
  meta: CompileMeta
  diagnostics: DiagnosticSink
  placeholders: PlaceholderRecord[]
  links: LinkRecord[]
  footnotes: FootnoteRecord[]
  counters: {
    images: number
    imageBytes: number
    imageSourceChars: number
    unnamedByKind: Record<string, number>
    unnamedTotalByKind: Record<string, number>
    link: number
    footnote: number
    codeBlocks: number
    tables: number
  }
  signal?: AbortSignal
  checkAbort(): void
  spanOf(node: MdNode | undefined): SourceSpan | undefined
}

export interface CodeToken {
  value: string
  color: string
}

export type CodeTokenLine = CodeToken[]

export interface HighlighterPort {
  available(): boolean
  highlight(code: string, lang: string | null, themeName: string): Promise<CodeTokenLine[] | null>
}

export interface InlinerPort {
  inline(html: string, css: string): string
}

export interface ConverterDeps {
  highlighter: HighlighterPort
  inliner: InlinerPort
}
