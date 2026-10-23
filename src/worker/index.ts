import { handleMessage } from './handler'
import type { WorkerRequest, WorkerResponse } from './protocol'

interface ParentPort {
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: WorkerResponse): void
}

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort

if (!parentPort) {
  // 直接在 Node 中运行时（调试）给出明确信息，不静默失败
  console.error('[md2w-worker] 需要在 Electron utilityProcess 中运行')
  process.exit(1)
}

parentPort.on('message', (event) => {
  const request = event.data as WorkerRequest
  if (!request || typeof request !== 'object' || !('type' in request)) return
  handleMessage(request, (message) => parentPort.postMessage(message))
})

parentPort.postMessage({ type: 'ready' })
