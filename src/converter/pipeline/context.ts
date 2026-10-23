import type { CompileMeta, CompileOptions } from '@shared/models/compile'
import type { Diagnostic, DiagnosticSummary, Severity } from '@shared/models/diagnostic'
import type { CompileContext, CompileInput, DiagnosticSink, MdNode } from './types'
import { DEFAULT_LIMITS } from './types'
import { spanFromPosition } from './ast'

interface SinkState {
  items: Diagnostic[]
  limit: number
  truncated: boolean
}

export function createDiagnosticSink(limit = DEFAULT_LIMITS.maxDiagnostics): DiagnosticSink {
  const state: SinkState = { items: [], limit, truncated: false }

  return {
    push(input) {
      if (state.items.length >= state.limit) {
        state.truncated = true
        return
      }
      const ordinal = state.items.length + 1
      state.items.push({ ...input, id: `${input.code}:${ordinal}` })
    },
    list() {
      return state.items.slice()
    },
    countBySeverity(severity: Severity) {
      return state.items.filter((item) => item.severity === severity).length
    },
    summary(): DiagnosticSummary {
      return {
        info: state.items.filter((item) => item.severity === 'info').length,
        warning: state.items.filter((item) => item.severity === 'warning').length,
        error: state.items.filter((item) => item.severity === 'error').length,
        review: state.items.filter((item) => item.review).length,
      }
    },
  }
}

export function createContext(
  input: CompileInput,
  sourceHash: string,
  meta: CompileMeta,
  sink?: DiagnosticSink,
): CompileContext {
  const diagnostics = sink ?? createDiagnosticSink()
  const context: CompileContext = {
    baseDir: input.baseDir,
    docId: input.docId,
    revision: input.revision,
    source: input.markdown,
    sourceHash,
    theme: input.theme,
    options: input.options as CompileOptions,
    meta,
    diagnostics,
    placeholders: [],
    links: [],
    footnotes: [],
    counters: {
      images: 0,
      imageBytes: 0,
      imageSourceChars: 0,
      unnamedByKind: { unnamed: 0, data: 0, svg: 0 },
      unnamedTotalByKind: { unnamed: 0, data: 0, svg: 0 },
      link: 0,
      footnote: 0,
      codeBlocks: 0,
      tables: 0,
    },
    signal: input.signal,
    checkAbort() {
      if (input.signal?.aborted) {
        const error = new Error('转换已取消')
        error.name = 'AbortError'
        throw error
      }
    },
    spanOf(node: MdNode | undefined) {
      return spanFromPosition(node?.position)
    },
  }
  return context
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export type { CompileContext }
