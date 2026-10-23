import { compileDocument } from '@converter/index'
import { getTheme } from '@themes/builtins/index'
import { ErrorCode, Md2wError } from '@shared/errors/codes'
import type { WorkerCompilePayload, WorkerRequest, WorkerResponse } from './protocol'

type Post = (message: WorkerResponse) => void

const controllers = new Map<string, AbortController>()
let running: string | null = null

export function handleMessage(request: WorkerRequest, post: Post): void {
  if (request.type === 'ping') {
    post({ type: 'pong' })
    return
  }

  if (request.type === 'cancel') {
    const controller = controllers.get(request.jobId)
    if (controller) controller.abort()
    return
  }

  if (request.type !== 'compile') return

  const payload = request.payload
  const controller = new AbortController()
  controllers.set(payload.jobId, controller)

  if (running) {
    controllers.get(running)?.abort()
  }
  running = payload.jobId
  void runJob(payload, controller, post)
}

async function runJob(
  payload: WorkerCompilePayload,
  controller: AbortController,
  post: Post,
): Promise<void> {
  try {
    const snapshot = await compileDocument({
      baseDir: payload.baseDir,
      docId: payload.docId,
      revision: payload.revision,
      markdown: payload.markdown,
      theme: payload.themeProfile ?? getTheme(payload.themeId),
      options: payload.options,
      signal: controller.signal,
    })
    post({ type: 'result', jobId: payload.jobId, snapshot })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      post({ type: 'cancelled', jobId: payload.jobId })
      return
    }
    const code = error instanceof Md2wError ? error.code : ErrorCode.CompileCrashed
    const message = error instanceof Error ? error.message : '转换失败'
    post({ type: 'error', jobId: payload.jobId, code, message })
  } finally {
    controllers.delete(payload.jobId)
    if (running === payload.jobId) running = null
  }
}
