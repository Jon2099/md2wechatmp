import type { CompileOptions } from '@shared/models/compile'
import type { ContentSnapshot } from '@shared/models/snapshot'
import type { ThemeProfile } from '@shared/models/theme'
import { ErrorCode, Md2wError } from '@shared/errors/codes'
import type { CompileExecutor } from '../jobs/worker-host'
import { snapshotStore } from './snapshot-store'
import { themeService } from './theme-service'

export interface CompilePayload {
  baseDir?: string
  docId: string
  revision: number
  markdown: string
  themeId: string
  themeProfile?: ThemeProfile
  options: CompileOptions
}

export type CompileEvent =
  | { ok: true; taskId: string; snapshot: ContentSnapshot }
  | { ok: false; taskId: string; code: string; message: string }

export class CompileService {
  private currentTaskId: string | null = null
  private seq = 0

  constructor(
    private readonly executor: CompileExecutor,
    private readonly emit: (event: CompileEvent) => void,
    private readonly preparePreview: (snapshot: ContentSnapshot, baseDir?: string) => Promise<ContentSnapshot> = async snapshot => snapshot,
  ) {}

  request(payload: CompilePayload): { taskId: string } {
    if (this.currentTaskId) {
      this.executor.cancel(this.currentTaskId)
    }
    this.seq += 1
    const taskId = `job-${this.seq}`
    this.currentTaskId = taskId

    const themeProfile = payload.themeProfile ?? themeService.getTheme(payload.themeId)
    void this.executor
      .run({ jobId: taskId, ...payload, themeProfile })
      .then(async (result) => {
        if (this.currentTaskId !== taskId) return
        const snapshot = await this.preparePreview(result, payload.baseDir)
        if (this.currentTaskId !== taskId) return
        snapshotStore.put(snapshot)
        this.emit({ ok: true, taskId, snapshot })
      })
      .catch((error: unknown) => {
        const code = error instanceof Md2wError ? error.code : ErrorCode.CompileCrashed
        const message = error instanceof Error ? error.message : '转换失败'
        if (code === ErrorCode.Aborted) return
        if (this.currentTaskId !== taskId) return
        this.emit({ ok: false, taskId, code, message })
      })

    return { taskId }
  }

  cancel(taskId: string): { cancelled: boolean } {
    const active = this.currentTaskId === taskId
    if (active) {
      this.executor.cancel(taskId)
      this.currentTaskId = null
    }
    return { cancelled: active }
  }

  dispose(): void {
    if (this.currentTaskId) this.executor.cancel(this.currentTaskId)
    this.currentTaskId = null
  }
}
