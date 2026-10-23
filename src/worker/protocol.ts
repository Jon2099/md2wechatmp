import type { CompileOptions } from '@shared/models/compile'
import type { ContentSnapshot } from '@shared/models/snapshot'
import type { ThemeProfile } from '@shared/models/theme'

export interface WorkerCompilePayload {
  baseDir?: string
  jobId: string
  docId: string
  revision: number
  markdown: string
  themeId: string
  themeProfile?: ThemeProfile
  options: CompileOptions
}

export type WorkerRequest =
  | { type: 'compile'; payload: WorkerCompilePayload }
  | { type: 'cancel'; jobId: string }
  | { type: 'ping' }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; jobId: string; snapshot: ContentSnapshot }
  | { type: 'cancelled'; jobId: string }
  | { type: 'error'; jobId: string; code: string; message: string }
  | { type: 'pong' }
