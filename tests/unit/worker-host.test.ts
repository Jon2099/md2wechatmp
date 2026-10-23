import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'
import type { ContentSnapshot } from '@shared/models/snapshot'

const h = vi.hoisted(() => ({ fork: vi.fn() }))
vi.mock('electron', () => ({ utilityProcess: { fork: h.fork } }))
const payload = { jobId: 'job-1', docId: 'doc-test', revision: 1, markdown: 'test', themeId: 'jade', options: DEFAULT_COMPILE_OPTIONS }
let host: InstanceType<typeof import('../../src/main/jobs/worker-host').WorkerHost>
let child: EventEmitter & { kill: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> }
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  h.fork.mockReset()
  child = Object.assign(new EventEmitter(), { kill: vi.fn(), postMessage: vi.fn() })
  h.fork.mockReturnValue(child)
  const { WorkerHost } = await import('../../src/main/jobs/worker-host')
  host = new WorkerHost()
})
afterEach(() => { host.dispose(); vi.clearAllTimers(); vi.useRealTimers() })

it('进程在 ready 前退出，启动任务立即失败而非永久等待', async () => {
  const running = host.run(payload)
  const failure = expect(running).rejects.toMatchObject({ code: 'E_WORKER_UNAVAILABLE' })
  child.emit('exit', 1)
  await failure
  expect(vi.getTimerCount()).toBe(0)
})

it('启动失败后可重试，迟到的旧进程退出不会清掉新进程', async () => {
  const first = host.run(payload)
  const failure = expect(first).rejects.toBeInstanceOf(Error)
  child.emit('exit', 1)
  await failure
  const old = child
  const next = Object.assign(new EventEmitter(), { kill: vi.fn(), postMessage: vi.fn() })
  h.fork.mockReturnValue(next)
  const running = host.run({ ...payload, jobId: 'job-2' })
  old.emit('exit', 1)
  next.emit('message', { type: 'ready' })
  await vi.advanceTimersByTimeAsync(0)
  const snapshot = { id: 'snapshot-2' } as ContentSnapshot
  next.emit('message', { type: 'result', jobId: 'job-2', snapshot })
  await expect(running).resolves.toEqual(snapshot)
  expect(next.postMessage).toHaveBeenCalledWith({ type: 'compile', payload: { ...payload, jobId: 'job-2' } })
})

it('启动超时和启动期间释放都能结算等待者并释放定时器', async () => {
  const running = host.run(payload)
  const failure = expect(running).rejects.toMatchObject({ code: 'E_ABORTED' })
  host.dispose()
  await failure
  expect(child.kill).toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('启动超时给出明确错误', async () => {
  const running = host.run(payload)
  const failure = expect(running).rejects.toMatchObject({ code: 'E_WORKER_UNAVAILABLE' })
  await vi.advanceTimersByTimeAsync(8000)
  await failure
  expect(child.kill).toHaveBeenCalled()
})
