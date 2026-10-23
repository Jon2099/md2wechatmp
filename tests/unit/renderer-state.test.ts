import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompileEvent } from '@shared/contracts/ipc'
import type { CompileRequest } from '@shared/models/compile'
import type { ContentSnapshot } from '@shared/models/snapshot'
import type { OpenedDocument } from '@shared/models/document'
import { deferred } from '../helpers/deferred'

let store: typeof import('../../src/renderer/state/store')
let emitResult: (event: CompileEvent) => void
let closeRequested: () => void
let revision: number
const doc = (id = 'doc-first', text = 'SAVED'): OpenedDocument => ({
  id, text, savedText: text, fileName: `${id}.md`, pathLabel: `${id}.md`, revision: 1, savedRevision: 1, dirty: false, externalChanged: false,
})
function snapshot(request: CompileRequest, text = 'SAVED'): ContentSnapshot {
  return {
    id: `snapshot-${request.revision}`, ...request, status: 'ok', html: `<section>${text}</section>`, plainText: text,
    diagnostics: [], meta: { title: '' }, stats: { chars: text.length, placeholders: 0, reviewItems: 0, links: 0, footnotes: 0, codeBlocks: 0, tables: 0, images: 0 },
    placeholders: [], links: [], footnotes: [], sourceHash: 'test', converterVersion: 'test', compatVersion: 'test', createdAt: 0,
  }
}

function makeBridge() {
  return {
    onCompileResult: (fn: typeof emitResult) => { emitResult = fn; return () => {} },
    onCloseRequested: (fn: typeof closeRequested) => { closeRequested = fn; return () => {} },
    onRecoveryAvailable: () => () => {}, onExternalChange: () => () => {}, onMenuAction: () => () => {},
    getSettings: async () => ({ ok: false }), listThemes: async () => ({ ok: true, data: [] }),
    createDocument: vi.fn(async () => ({ ok: true as const, data: doc() })),
    openDocument: vi.fn(async () => ({ ok: true as const, data: doc('doc-second', 'SECOND') as OpenedDocument | null })),
    updateSource: vi.fn(async (_req: { docId: string; baseRevision: number; text: string }) => ({ ok: true as const, data: { revision: ++revision } })),
    requestCompile: vi.fn(async (_req: CompileRequest) => ({ ok: true as const, data: { taskId: `job-${revision}` } })),
    saveDocument: vi.fn(async (req: { docId: string; revision: number }) => ({ ok: true as const, data: { ok: true as const, revision: req.revision, fileName: 'saved.md', pathLabel: 'saved.md' } })),
    saveDocumentAs: vi.fn(async (req: { docId: string; revision: number }) => ({ ok: true as const, data: { ok: true as const, revision: req.revision, fileName: 'copy.md', pathLabel: 'copy.md' } })),
    takeRecovery: vi.fn(async (_req: { docId: string }) => ({ ok: true as const, data: { ...doc('doc-recovered', 'RECOVERED'), savedText: 'DISK', revision: 2, dirty: true } })),
    completeClose: vi.fn(async (_req: { docId: string | null; revision: number }) => ({ ok: true as const, data: null })),
    copySnapshot: vi.fn(),
  }
}
let bridge: ReturnType<typeof makeBridge>
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  revision = 1
  bridge = makeBridge()
  vi.stubGlobal('window', { md2w: bridge })
  store = await import('../../src/renderer/state/store')
  await store.init()
})
afterEach(() => { store.dispose(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('保存与恢复的界面状态', () => {
  it('保存期间继续编辑，完成后仍提示未保存', async () => {
    const started = deferred(), done = deferred<Awaited<ReturnType<typeof bridge.saveDocument>>>()
    bridge.saveDocument.mockImplementationOnce(() => { started.resolve(); return done.promise })
    store.onTextChange('TO SAVE')
    const saving = store.save()
    await started.promise
    const req = bridge.saveDocument.mock.calls[0][0]
    store.onTextChange('NEW UNSAVED')
    done.resolve({ ok: true, data: { ok: true, revision: req.revision, fileName: 'saved.md', pathLabel: 'saved.md' } })
    await saving
    expect(store.view.savedText).toBe('TO SAVE')
    expect(store.view.text).toBe('NEW UNSAVED')
    expect(store.dirty.value).toBe(true)
  })

  it('旧文档的保存完成不覆盖新文档的名称和保存状态', async () => {
    const started = deferred(), done = deferred<Awaited<ReturnType<typeof bridge.saveDocument>>>()
    bridge.saveDocument.mockImplementationOnce(() => { started.resolve(); return done.promise })
    const saving = store.save()
    await started.promise
    await store.openFile()
    done.resolve({ ok: true, data: { ok: true, revision: 2, fileName: 'OLD.md', pathLabel: 'OLD.md' } })
    await saving
    expect(store.view.fileName).toBe('doc-second.md')
    expect(store.view.savedText).toBe('SECOND')
  })

  it('保存位置改变后重新编译，避免沿用旧目录解析的图片', async () => {
    await store.compileNow()
    const req = bridge.requestCompile.mock.calls[0][0]
    emitResult({ ok: true, taskId: 'job-2', snapshot: snapshot(req) })
    expect(store.canCopy.value).toBe(true)
    await store.save(true)
    expect(store.snapshotFresh.value).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(bridge.requestCompile).toHaveBeenCalledTimes(2)
  })

  it('恢复文本保留未保存标记，新建时必须确认', async () => {
    store.view.recovery = { docId: 'doc-recovered', fileName: 'recovery.md', updatedAt: 0 }
    await store.acceptRecovery()
    expect(store.dirty.value).toBe(true)
    expect(store.view.savedText).toBe('DISK')
    const creating = store.newDocument()
    expect(store.view.confirmation?.action).toBe('new')
    store.resolveConfirmation(false)
    await creating
    expect(store.view.docId).toBe('doc-recovered')
    expect(bridge.createDocument).toHaveBeenCalledTimes(1)
  })
})

describe('编译结果归属', () => {
  it('源文同步期间继续输入，不会提交旧文本并启用复制', async () => {
    const update = deferred<Awaited<ReturnType<typeof bridge.updateSource>>>()
    bridge.updateSource.mockReturnValueOnce(update.promise)
    const compiling = store.compileNow()
    store.onTextChange('NEW')
    update.resolve({ ok: true, data: { revision: 2 } })
    await compiling
    expect(bridge.requestCompile).not.toHaveBeenCalled()
    expect(store.canCopy.value).toBe(false)
    expect(store.snapshotFresh.value).toBe(false)
  })

  it('匹配的成功结果恢复复制；后续编辑立即使其失效', async () => {
    await store.compileNow()
    const req = bridge.requestCompile.mock.calls[0][0]
    emitResult({ ok: true, taskId: 'job-2', snapshot: snapshot(req) })
    expect(store.canCopy.value).toBe(true)
    store.onTextChange('NEW')
    expect(store.canCopy.value).toBe(false)
  })

  it('先于 requestCompile 回复到达的结果不会丢失', async () => {
    bridge.requestCompile.mockImplementationOnce(async (req) => {
      emitResult({ ok: true, taskId: 'job-early', snapshot: snapshot(req) })
      return { ok: true, data: { taskId: 'job-early' } }
    })
    await store.compileNow()
    expect(store.canCopy.value).toBe(true)
    expect(store.view.pending).toBe(false)
  })

  it('旧任务和其他文档的迟到结果不能覆盖当前状态', async () => {
    await store.compileNow()
    const old = bridge.requestCompile.mock.calls[0][0]
    await store.openFile()
    await store.compileNow()
    const latest = bridge.requestCompile.mock.calls[1][0]
    emitResult({ ok: true, taskId: 'job-2', snapshot: snapshot(old, 'OLD') })
    expect(store.view.snapshot).toBeNull()
    expect(store.view.pending).toBe(true)
    emitResult({ ok: true, taskId: 'job-3', snapshot: snapshot(latest, 'SECOND') })
    expect(store.view.snapshot?.plainText).toBe('SECOND')
    expect(store.canCopy.value).toBe(true)
  })
})

describe('关闭窗口', () => {
  it('取消关闭时不提交源文或关闭窗口', async () => {
    store.onTextChange('UNSAVED')
    const closing = store.requestClose()
    expect(store.view.confirmation?.action).toBe('close')
    store.resolveConfirmation(false)
    await closing
    expect(bridge.updateSource).not.toHaveBeenCalled()
    expect(bridge.completeClose).not.toHaveBeenCalled()
    expect(store.view.busy).toBe(false)
  })

  it('关闭请求立即同步最新输入，等待完成后才请求原生关闭', async () => {
    store.onTextChange('LAST KEYSTROKE')
    const started = deferred(), update = deferred<Awaited<ReturnType<typeof bridge.updateSource>>>()
    bridge.updateSource.mockImplementationOnce(() => { started.resolve(); return update.promise })
    const closing = store.requestClose()
    store.resolveConfirmation(true)
    await started.promise
    expect(store.view.busy).toBe(true)
    expect(bridge.completeClose).not.toHaveBeenCalled()
    expect(bridge.updateSource.mock.calls[0][0].text).toBe('LAST KEYSTROKE')
    update.resolve({ ok: true, data: { revision: 2 } })
    await closing
    expect(bridge.completeClose).toHaveBeenCalledWith({ docId: 'doc-first', revision: 2 })
    expect(store.view.busy).toBe(false)
  })

  it('操作系统关闭事件也走相同保护，失败后解除锁定且允许重试', async () => {
    bridge.completeClose.mockRejectedValueOnce(new Error('disk full'))
    const attempted = deferred()
    bridge.updateSource.mockImplementationOnce(async () => { attempted.resolve(); return { ok: true, data: { revision: 2 } } })
    closeRequested()
    await attempted.promise
    await vi.advanceTimersByTimeAsync(0)
    expect(store.view.busy).toBe(false)
    expect(store.view.toast?.text).toBe('disk full')
    await store.requestClose()
    expect(bridge.completeClose).toHaveBeenCalledTimes(2)
  })
})

describe('应用内未保存确认弹窗', () => {
  it.each(['new', 'open', 'close'] as const)('取消 %s 操作会保留原文且不执行动作', async (action) => {
    store.onTextChange('UNSAVED')
    const operation = action === 'new' ? store.newDocument : action === 'open' ? store.openFile : store.requestClose
    const pending = operation()
    expect(store.view.confirmation?.action).toBe(action)
    expect(store.view.docId).toBe('doc-first')
    expect(bridge.openDocument).not.toHaveBeenCalled()
    expect(bridge.completeClose).not.toHaveBeenCalled()
    store.resolveConfirmation(false)
    await pending
    expect(store.view.confirmation).toBeNull()
    expect(store.view.text).toBe('UNSAVED')
    expect(store.dirty.value).toBe(true)
    expect(bridge.createDocument).toHaveBeenCalledTimes(1)
  })

  it('确认打开后才切换文档，重复请求与后台快捷操作不会覆盖确认', async () => {
    store.onTextChange('UNSAVED')
    const opening = store.openFile()
    await store.requestClose()
    await store.newDocument()
    await store.save()
    store.handleMenuAction('theme:open-modal')
    store.onTextChange('BACKGROUND EDIT')
    expect(store.view.text).toBe('UNSAVED')
    expect(store.view.confirmation?.action).toBe('open')
    expect(store.view.showThemeModal).toBe(false)
    expect(bridge.saveDocument).not.toHaveBeenCalled()
    store.resolveConfirmation(true)
    store.resolveConfirmation(true)
    await opening
    expect(bridge.openDocument).toHaveBeenCalledTimes(1)
    expect(store.view.docId).toBe('doc-second')
  })

  it('已保存文档直接执行；异步打开期间不会重复新建或关闭', async () => {
    const done = deferred<Awaited<ReturnType<typeof bridge.openDocument>>>()
    bridge.openDocument.mockReturnValueOnce(done.promise)
    const opening = store.openFile()
    await Promise.resolve()
    expect(store.view.confirmation).toBeNull()
    expect(store.view.busy).toBe(true)
    await store.newDocument()
    await store.requestClose()
    done.resolve({ ok: true, data: doc('doc-second') })
    await opening
    expect(bridge.createDocument).toHaveBeenCalledTimes(1)
    expect(bridge.completeClose).not.toHaveBeenCalled()
    expect(store.view.busy).toBe(false)
  })

  it('卸载时取消未决确认，不执行离开文档操作', async () => {
    store.onTextChange('UNSAVED')
    const opening = store.openFile()
    store.dispose()
    await opening
    expect(store.view.confirmation).toBeNull()
    expect(bridge.openDocument).not.toHaveBeenCalled()
  })

  it('取消系统文件选择后恢复被暂停的自动转换', async () => {
    store.onTextChange('UNSAVED')
    const done = deferred<Awaited<ReturnType<typeof bridge.openDocument>>>()
    bridge.openDocument.mockReturnValueOnce(done.promise)
    const opening = store.openFile()
    store.resolveConfirmation(true)
    await vi.advanceTimersByTimeAsync(400)
    expect(store.view.busy).toBe(true)
    expect(bridge.requestCompile).not.toHaveBeenCalled()
    done.resolve({ ok: true, data: null })
    await opening
    await vi.advanceTimersByTimeAsync(0)
    expect(store.view.text).toBe('UNSAVED')
    expect(bridge.requestCompile).toHaveBeenCalledTimes(1)
  })

  it('复制成功后保持 copied 状态，2 秒后自动还原为 idle', async () => {
    store.onTextChange('TEST TEXT')
    await vi.advanceTimersByTimeAsync(400)
    const req = bridge.requestCompile.mock.calls[0][0]
    emitResult({ ok: true, taskId: 'job-2', snapshot: snapshot(req) })

    bridge.copySnapshot.mockResolvedValueOnce({
      ok: true,
      data: { verified: true, message: '已复制到剪贴板', placeholders: 0, reviewItems: 0 },
    })

    await store.copyToWechat()
    expect(store.view.copyState).toBe('copied')

    await vi.advanceTimersByTimeAsync(1500)
    expect(store.view.copyState).toBe('copied')

    await vi.advanceTimersByTimeAsync(600)
    expect(store.view.copyState).toBe('idle')
  })

  it('支持切换关于弹窗状态与菜单指令', () => {
    expect(store.view.showAboutModal).toBe(false)
    store.toggleAboutModal()
    expect(store.view.showAboutModal).toBe(true)
    store.toggleAboutModal(false)
    expect(store.view.showAboutModal).toBe(false)

    store.handleMenuAction('help:open-about')
    expect(store.view.showAboutModal).toBe(true)
  })
})
