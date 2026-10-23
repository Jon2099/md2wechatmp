import type { Diagnostic, SourceSpan } from './diagnostic'
import type { CompileMeta, CompileOptions } from './compile'
import type { ThemeId } from './theme'

export type MediaType = 'image' | 'video'
export type ImageKind = 'file' | 'url' | 'data' | 'svg' | 'unnamed' | 'video' | 'iframe'

export interface PlaceholderRecord {
  index: number
  text: string
  fileName: string
  kind: ImageKind
  mediaType?: MediaType
  span?: SourceSpan
  /** Video metadata is for desktop preview only, never copied or exported. */
  source?: string
  previewUrl?: string
  previewError?: string
}

export interface LinkRecord {
  index: number
  url: string
  text: string
  span?: SourceSpan
}

export interface FootnoteRecord {
  index: number
  label: string
  text: string
}

export interface SnapshotStats {
  chars: number
  placeholders: number
  reviewItems: number
  links: number
  footnotes: number
  codeBlocks: number
  tables: number
  images: number
  videos?: number
}

export interface ContentSnapshot {
  id: string
  docId: string
  revision: number
  themeId: ThemeId
  options: CompileOptions
  status: 'ok' | 'blocked'
  html: string
  plainText: string
  diagnostics: Diagnostic[]
  meta: CompileMeta
  stats: SnapshotStats
  placeholders: PlaceholderRecord[]
  links: LinkRecord[]
  footnotes: FootnoteRecord[]
  sourceHash: string
  converterVersion: string
  compatVersion: string
  createdAt: number
}
