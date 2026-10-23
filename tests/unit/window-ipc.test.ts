import { beforeEach, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/contracts/ipc'
import { deferred } from '../helpers/deferred'

const h = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => Promise<unknown>>(),
  flush: vi.fn(), state: vi.fn(), finish: vi.fn(),
  window: { isDestroyed: () => false },
}))
vi.mock('../../src/main/ipc/register', () => ({
  handle: (channel: string, _schema: unknown, fn: (payload: unknown) => Promise<unknown>) => h.handlers.set(channel, fn),
  getMainWindow: () => h.window,
}))
vi.mock('../../src/main/services/document-service', () => ({ flushWorkcopies: h.flush, getDocumentState: h.state }))
vi.mock('../../src/main/close-guard', () => ({ finishWindowClose: h.finish }))

beforeEach(async () => {
  h.handlers.clear()
  h.flush.mockReset().mockResolvedValue(undefined)
  h.state.mockReset().mockReturnValue({ revision: 2 })
  h.finish.mockReset()
  const { registerWindowIpc } = await import('../../src/main/ipc/window')
  registerWindowIpc()
})

const close = () => h.handlers.get(CHANNELS.windowCloseComplete)!({ docId: 'doc-test', revision: 2 })

it('工作副本写完之前不允许原生关闭', async () => {
  const saving = deferred()
  h.flush.mockReturnValueOnce(saving.promise)
  const closing = close()
  expect(h.finish).not.toHaveBeenCalled()
  saving.resolve()
  await closing
  expect(h.finish).toHaveBeenCalledWith(h.window)
})

it('持久化失败保留窗口且可重试', async () => {
  h.flush.mockRejectedValueOnce(new Error('disk full'))
  await expect(close()).rejects.toThrow('disk full')
  expect(h.finish).not.toHaveBeenCalled()
  await close()
  expect(h.finish).toHaveBeenCalledTimes(1)
})

it('关闭提交的修订必须在刷新前后都保持有效', async () => {
  h.state.mockReturnValueOnce({ revision: 3 })
  await expect(close()).rejects.toMatchObject({ code: 'E_SNAPSHOT_STALE' })
  expect(h.flush).not.toHaveBeenCalled()
  h.state.mockReturnValueOnce({ revision: 2 }).mockReturnValueOnce({ revision: 3 })
  await expect(close()).rejects.toMatchObject({ code: 'E_SNAPSHOT_STALE' })
  expect(h.finish).not.toHaveBeenCalled()
})
