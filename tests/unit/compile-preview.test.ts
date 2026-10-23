import { afterEach, expect, it, vi } from 'vitest'
import { CompileService } from '../../src/main/services/compile-service'
import { snapshotStore } from '../../src/main/services/snapshot-store'
import type { ContentSnapshot } from '@shared/models/snapshot'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'
import { compile } from '../helpers/compile'
import { deferred } from '../helpers/deferred'

afterEach(() => snapshotStore.clear())
const payload = { docId: 'doc-test', revision: 1, markdown: '![视频](clip.webm)', themeId: 'ocean-blue', options: DEFAULT_COMPILE_OPTIONS, baseDir: 'C:/demo' }
const tick = () => new Promise<void>(resolve => setImmediate(resolve))

it('等待视频预览准备完成后再发布快照，原始文章不受影响', async () => {
  const original = await compile(payload.markdown)
  const entered = deferred(), ready = deferred<ContentSnapshot>()
  const prepare = vi.fn(async () => { entered.resolve(); return ready.promise })
  const emit = vi.fn()
  const service = new CompileService({ run: async () => original, cancel: vi.fn(), dispose: vi.fn() }, emit, prepare)
  const { taskId } = service.request(payload)
  await entered.promise
  expect(emit).not.toHaveBeenCalled()
  expect(prepare).toHaveBeenCalledWith(original, 'C:/demo')
  const prepared = { ...original, placeholders: [{ ...original.placeholders[0], previewUrl: 'md2w-media://video/11111111-1111-1111-1111-111111111111' }] }
  ready.resolve(prepared)
  await tick()
  expect(emit).toHaveBeenCalledWith({ ok: true, taskId, snapshot: prepared })
  expect(snapshotStore.get(original.id, original.revision).html).toBe(original.html)
  service.dispose()
})

it('旧任务的视频读取迟到时，不能发布旧结果或覆盖新任务', async () => {
  const first = await compile('![旧视频](old.webm)')
  const second = await compile('![新视频](new.webm)')
  const entered = deferred(), late = deferred<ContentSnapshot>()
  const executor = { run: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second), cancel: vi.fn(), dispose: vi.fn() }
  const emit = vi.fn()
  const prepare = vi.fn(async (snapshot: ContentSnapshot) => {
    if (snapshot === first) { entered.resolve(); return late.promise }
    return snapshot
  })
  const service = new CompileService(executor, emit, prepare)
  service.request(payload)
  await entered.promise
  const latest = service.request({ ...payload, revision: 2 })
  await tick()
  late.resolve(first)
  await tick()
  expect(emit).toHaveBeenCalledTimes(1)
  expect(emit).toHaveBeenCalledWith({ ok: true, taskId: latest.taskId, snapshot: second })
  expect(() => snapshotStore.get(first.id, first.revision)).toThrow('已失效')
  service.dispose()
})
