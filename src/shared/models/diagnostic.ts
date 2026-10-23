export type Severity = 'info' | 'warning' | 'error'

export interface SourceSpan {
  line: number
  column: number
  endLine: number
  endColumn: number
  offset: number
}

export interface Diagnostic {
  id: string
  code: string
  severity: Severity
  message: string
  action?: string
  advice?: string
  span?: SourceSpan
  review: boolean
}

export interface DiagnosticSummary {
  info: number
  warning: number
  error: number
  review: number
}
