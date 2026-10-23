export const ErrorCode = {
  InvalidInput: 'E_INVALID_INPUT',
  LimitExceeded: 'E_LIMIT_EXCEEDED',
  ParseFailed: 'E_PARSE_FAILED',
  CompileTimeout: 'E_COMPILE_TIMEOUT',
  CompileCrashed: 'E_COMPILE_CRASHED',
  WorkerUnavailable: 'E_WORKER_UNAVAILABLE',
  SnapshotMissing: 'E_SNAPSHOT_MISSING',
  SnapshotStale: 'E_SNAPSHOT_STALE',
  SnapshotBlocked: 'E_SNAPSHOT_BLOCKED',
  ClipboardFailed: 'E_CLIPBOARD_FAILED',
  FileChanged: 'E_FILE_CHANGED',
  FileReadFailed: 'E_FILE_READ_FAILED',
  FileWriteFailed: 'E_FILE_WRITE_FAILED',
  DocumentMissing: 'E_DOCUMENT_MISSING',
  SaveCancelled: 'E_SAVE_CANCELLED',
  Aborted: 'E_ABORTED',
  Internal: 'E_INTERNAL',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

export class Md2wError extends Error {
  readonly code: ErrorCodeValue
  readonly detail?: string

  constructor(code: ErrorCodeValue, message: string, detail?: string) {
    super(message)
    this.name = 'Md2wError'
    this.code = code
    this.detail = detail
  }
}

export interface ErrorPayload {
  ok: false
  code: ErrorCodeValue
  message: string
}

export function toErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof Md2wError) {
    return { ok: false, code: error.code, message: error.message }
  }
  if (error instanceof Error) {
    return { ok: false, code: ErrorCode.Internal, message: error.message }
  }
  return { ok: false, code: ErrorCode.Internal, message: '未知错误' }
}
