import { beforeEach, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/contracts/ipc'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'

const h = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => unknown>(),
  state: vi.fn(), text: vi.fn(), request: vi.fn(), cancel: vi.fn(),
}))
vi.mock('../../src/main/ipc/register', () => ({
  handle: (channel: string, _schema: unknown, fn: (payload: unknown) => unknown) => h.handlers.set(channel, fn),
}))
vi.mock('../../src/main/services/document-service', () => ({ getDocumentState: h.state, getDocumentText: h.text, getDocumentBaseDir: () => undefined }))
beforeEach(async () => {
  h.handlers.clear()
  h.state.mockReset().mockReturnValue({ revision: 2 })
  h.text.mockReset().mockReturnValue('LATEST')
  h.request.mockReset().mockReturnValue({ taskId: 'job-test' })
  const { registerCompileIpc } = await import('../../src/main/ipc/compile')
  registerCompileIpc({ request: h.request, cancel: h.cancel } as unknown as import('../../src/main/services/compile-service').CompileService)
})
const payload = { docId: 'doc-test', revision: 2, themeId: 'jade', options: DEFAULT_COMPILE_OPTIONS }

it('主进程拒绝给新源文贴上旧修订号', () => {
  h.state.mockReturnValue({ revision: 3 })
  expect(() => h.handlers.get(CHANNELS.compileRequest)!(payload)).toThrow('内容已更新')
  expect(h.request).not.toHaveBeenCalled()
})

it('修订匹配时提交对应源文并允许正常编译', () => {
  expect(h.handlers.get(CHANNELS.compileRequest)!(payload)).toEqual({ taskId: 'job-test' })
  expect(h.request).toHaveBeenCalledWith({ ...payload, markdown: 'LATEST' })
})
