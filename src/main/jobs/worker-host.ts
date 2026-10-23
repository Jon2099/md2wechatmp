import { join } from 'node:path'
import { utilityProcess, type UtilityProcess } from 'electron'
import type { ContentSnapshot } from '@shared/models/snapshot'
import { ErrorCode, Md2wError } from '@shared/errors/codes'
import type { WorkerCompilePayload, WorkerRequest, WorkerResponse } from '../../worker/protocol'

interface Pending {
  jobId: string
  resolve: (snapshot: ContentSnapshot) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export interface CompileExecutor {
  run(payload: WorkerCompilePayload): Promise<ContentSnapshot>
  cancel(jobId: string): void
  dispose(): void
}

const READY_TIMEOUT = 8000
const CRASH_WINDOW = 60_000
const CRASH_LIMIT = 2

export class WorkerHost implements CompileExecutor {
  private child: UtilityProcess | null = null
  private readyPromise: Promise<void> | null = null
  private rejectReady: ((error: Error) => void) | null = null
  private detachMessage: (() => void) | null = null
  private pending = new Map<string, Pending>()
  private crashTimes: number[] = []
  private degraded = false

  private ensureChild(): Promise<void> {
    if (this.degraded) {
      return Promise.reject(
        new Md2wError(ErrorCode.WorkerUnavailable, '转换服务多次异常，请重启应用后重试。'),
      )
    }
    if (this.readyPromise) return this.readyPromise

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const entry = join(__dirname, 'worker', 'compile.js')
      const child = utilityProcess.fork(entry, [], {
        serviceName: 'md2w-compile',
        stdio: 'pipe',
      })
      this.child = child

      const timer = setTimeout(() => {
        reject(new Md2wError(ErrorCode.WorkerUnavailable, '转换进程启动超时。'))
        child.kill()
      }, READY_TIMEOUT)
      this.rejectReady = (error) => { clearTimeout(timer); reject(error) }

      const onMessage = (message: WorkerResponse) => {
        if (message.type === 'ready') {
          clearTimeout(timer)
          this.rejectReady = null
          resolve()
          return
        }
        this.handleMessage(message)
      }

      this.detachMessage = () => child.off('message', onMessage)

      child.on('message', onMessage)
      child.on('exit', () => {
        clearTimeout(timer)
        reject(new Md2wError(ErrorCode.WorkerUnavailable, '转换进程在启动期间退出，请重试。'))
        if (this.child !== child) return
        this.rejectReady = null
        this.detachMessage = null
        this.readyPromise = null
        this.child = null
        const now = Date.now()
        this.crashTimes = this.crashTimes.filter((time) => now - time < CRASH_WINDOW)
        this.crashTimes.push(now)
        if (this.crashTimes.length > CRASH_LIMIT) this.degraded = true

        for (const [jobId, item] of this.pending) {
          clearTimeout(item.timer)
          item.reject(new Md2wError(ErrorCode.CompileCrashed, '转换进程异常退出，请重试。'))
          this.pending.delete(jobId)
        }
      })
    })

    const readyPromise = this.readyPromise
    void readyPromise.catch(() => {
      if (this.readyPromise === readyPromise) this.readyPromise = null
    })

    return readyPromise
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type === 'result') {
      const item = this.pending.get(message.jobId)
      if (!item) return
      clearTimeout(item.timer)
      this.pending.delete(message.jobId)
      item.resolve(message.snapshot)
      return
    }
    if (message.type === 'error') {
      const item = this.pending.get(message.jobId)
      if (!item) return
      clearTimeout(item.timer)
      this.pending.delete(message.jobId)
      item.reject(new Md2wError(message.code as never, message.message))
      return
    }
    if (message.type === 'cancelled') {
      const item = this.pending.get(message.jobId)
      if (!item) return
      clearTimeout(item.timer)
      this.pending.delete(message.jobId)
      item.reject(new Md2wError(ErrorCode.Aborted, '转换已取消。'))
    }
  }

  async run(payload: WorkerCompilePayload): Promise<ContentSnapshot> {
    await this.ensureChild()
    const child = this.child
    if (!child) throw new Md2wError(ErrorCode.WorkerUnavailable, '转换进程不可用。')

    const timeoutMs = Math.min(20000, Math.max(5000, 5000 + Math.ceil(payload.markdown.length / 2000) * 300))

    return new Promise<ContentSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(payload.jobId)
        reject(new Md2wError(ErrorCode.CompileTimeout, '转换超时，请缩短内容后重试。'))
        child.kill()
      }, timeoutMs)

      this.pending.set(payload.jobId, { jobId: payload.jobId, resolve, reject, timer })
      const request: WorkerRequest = { type: 'compile', payload }
      child.postMessage(request)
    })
  }

  cancel(jobId: string): void {
    const item = this.pending.get(jobId)
    if (item) {
      clearTimeout(item.timer)
      this.pending.delete(jobId)
      item.reject(new Md2wError(ErrorCode.Aborted, '转换已取消。'))
    }
    const request: WorkerRequest = { type: 'cancel', jobId }
    this.child?.postMessage(request)
  }

  dispose(): void {
    this.rejectReady?.(new Md2wError(ErrorCode.Aborted, '转换已取消。'))
    this.rejectReady = null
    for (const item of this.pending.values()) {
      clearTimeout(item.timer)
      item.reject(new Md2wError(ErrorCode.Aborted, '转换已取消。'))
    }
    this.pending.clear()
    this.detachMessage?.()
    this.detachMessage = null
    this.child?.kill()
    this.child = null
    this.readyPromise = null
  }
}
