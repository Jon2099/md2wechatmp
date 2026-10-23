import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, stat, utimes, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { deferred } from '../helpers/deferred'

const h = vi.hoisted(() => ({ root: '', target: '', paused: '', failPath: '',
  gate: null as Promise<void> | null, entered: null as (() => void) | null,
  dialogGate: null as Promise<void> | null, dialogEntered: null as (() => void) | null,
}))
vi.mock('electron', () => ({
  app: { getPath: () => h.root },
  dialog: {
    showOpenDialog: async () => ({ canceled: false, filePaths: [h.target] }),
    showSaveDialog: async () => { h.dialogEntered?.(); await h.dialogGate; return { canceled: false, filePath: h.target } },
  },
}))
vi.mock('../../src/main/store/atomic-write', () => ({
  writeFileAtomic: async (path: string, content: string) => {
    if (path === h.paused) { h.entered?.(); await h.gate }
    if (path === h.failPath) throw new Error('disk full')
    const actual = await vi.importActual<typeof import('../../src/main/store/atomic-write')>('../../src/main/store/atomic-write')
    return actual.writeFileAtomic(path, content)
  },
}))

let service: typeof import('../../src/main/services/document-service')
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  await mkdir(resolve('tests/.tmp'), { recursive: true })
  h.root = await mkdtemp(resolve('tests/.tmp/doc-'))
  h.target = join(h.root, 'article.md')
  h.paused = h.failPath = ''
  h.gate = h.dialogGate = null
  h.entered = h.dialogEntered = null
  service = await import('../../src/main/services/document-service')
})
afterEach(async () => {
  h.failPath = h.paused = ''
  await service.flushWorkcopies()
  vi.restoreAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('保存修订与工作副本', () => {
  it('保存期间的新编辑保持未保存，磁盘与返回值只确认提交的版本', async () => {
    const doc = service.createDocument()
    const revision = service.updateSource(doc.id, doc.revision, 'OLD').revision
    const started = deferred(), release = deferred()
    h.paused = h.target; h.gate = release.promise; h.entered = () => started.resolve()
    const saving = service.saveDocument(doc.id, revision, false, null)
    await started.promise
    const latest = service.updateSource(doc.id, revision, 'NEW').revision
    release.resolve()
    const result = await saving
    expect(await readFile(h.target, 'utf8')).toBe('OLD')
    expect(result?.revision).toBe(revision)
    expect(service.getDocumentState(doc.id)).toMatchObject({ revision: latest, savedRevision: revision, dirty: true })
  })

  it('另存为对话框等待期间也不改变要保存的文本', async () => {
    const doc = service.createDocument()
    const revision = service.updateSource(doc.id, doc.revision, 'SELECTED VERSION').revision
    const started = deferred(), release = deferred()
    h.dialogGate = release.promise; h.dialogEntered = () => started.resolve()
    const saving = service.saveDocument(doc.id, revision, true, null)
    await started.promise
    service.updateSource(doc.id, revision, 'NEW EDIT')
    release.resolve()
    await saving
    expect(await readFile(h.target, 'utf8')).toBe('SELECTED VERSION')
    expect(service.getDocumentState(doc.id)?.dirty).toBe(true)
  })

  it('连续保存串行完成，最后一次保存不会被较旧请求覆盖', async () => {
    const doc = service.createDocument()
    const revision = service.updateSource(doc.id, doc.revision, 'FIRST').revision
    const started = deferred(), release = deferred()
    h.paused = h.target; h.gate = release.promise; h.entered = () => started.resolve()
    const first = service.saveDocument(doc.id, revision, false, null)
    await started.promise
    const latest = service.updateSource(doc.id, revision, 'SECOND').revision
    const second = service.saveDocument(doc.id, latest, false, null)
    release.resolve()
    await Promise.all([first, second])
    expect(await readFile(h.target, 'utf8')).toBe('SECOND')
    expect(service.getDocumentState(doc.id)).toMatchObject({ savedRevision: latest, dirty: false })
  })

  it('关闭前立即刷新草稿，无需等待 600ms，并保存原文件基线', async () => {
    await writeFile(h.target, 'ORIGINAL')
    const doc = (await service.openDocument(null))!
    service.updateSource(doc.id, doc.revision, 'LATEST DRAFT')
    await service.flushWorkcopies()
    const draft = JSON.parse(await readFile(join(h.root, 'workcopies', `${doc.id}.json`), 'utf8'))
    expect(draft).toMatchObject({ text: 'LATEST DRAFT', savedText: 'ORIGINAL', mtimeMs: (await stat(h.target)).mtimeMs })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('刷新草稿失败时将错误传回关闭流程', async () => {
    const doc = service.createDocument()
    service.updateSource(doc.id, doc.revision, 'UNSAVED')
    h.failPath = join(h.root, 'workcopies', `${doc.id}.json`)
    await expect(service.flushWorkcopies()).rejects.toThrow('disk full')
  })

  it('关闭刷新等待先前的草稿写入，并确保最新修订最后落盘', async () => {
    await writeFile(h.target, 'ORIGINAL')
    const started = deferred(), release = deferred()
    // The open operation schedules an immediate copy; pause that older write.
    const actual = await vi.importActual<typeof import('../../src/main/store/atomic-write')>('../../src/main/store/atomic-write')
    const writer = vi.spyOn(await import('../../src/main/store/atomic-write'), 'writeFileAtomic')
    writer.mockImplementationOnce(async (path, content) => { started.resolve(); await release.promise; await actual.writeFileAtomic(path, content) })
    const doc = (await service.openDocument(null))!
    await started.promise
    const latest = service.updateSource(doc.id, doc.revision, 'LATEST').revision
    const flushing = service.flushWorkcopies()
    release.resolve()
    await flushing
    const draft = JSON.parse(await readFile(join(h.root, 'workcopies', `${doc.id}.json`), 'utf8'))
    expect(draft).toMatchObject({ revision: latest, text: 'LATEST' })
    writer.mockRestore()
  })

  it('关闭刷新也等待正在进行的文件保存，保留最终保存基线', async () => {
    const doc = service.createDocument()
    const revision = service.updateSource(doc.id, doc.revision, 'TO SAVE').revision
    const started = deferred(), release = deferred()
    h.paused = h.target; h.gate = release.promise; h.entered = () => started.resolve()
    const saving = service.saveDocument(doc.id, revision, false, null)
    await started.promise
    let flushed = false
    const flushing = service.flushWorkcopies().then(() => { flushed = true })
    await Promise.resolve()
    expect(flushed).toBe(false)
    release.resolve()
    await Promise.all([saving, flushing])
    expect(await readFile(h.target, 'utf8')).toBe('TO SAVE')
    const draft = JSON.parse(await readFile(join(h.root, 'workcopies', `${doc.id}.json`), 'utf8'))
    expect(draft).toMatchObject({ savedRevision: revision, savedText: 'TO SAVE' })
  })
})

describe('恢复副本', () => {
  async function recoverDraft() {
    await writeFile(h.target, 'SAVED')
    const doc = (await service.openDocument(null))!
    service.updateSource(doc.id, doc.revision, 'RECOVERED')
    await service.flushWorkcopies()
    return (await service.takeRecovery(doc.id))!
  }

  it('恢复保留 dirty 和 savedText，未修改的原文件可以正常保存', async () => {
    const recovered = await recoverDraft()
    expect(recovered).toMatchObject({ text: 'RECOVERED', savedText: 'SAVED', dirty: true })
    await service.saveDocument(recovered.id, recovered.revision, false, null)
    expect(await readFile(h.target, 'utf8')).toBe('RECOVERED')
    expect(service.getDocumentState(recovered.id)?.dirty).toBe(false)
  })

  it('恢复后仍然拒绝覆盖真正的外部改动', async () => {
    const recovered = await recoverDraft()
    await writeFile(h.target, 'EXTERNAL')
    await utimes(h.target, new Date(), new Date(Date.now() + 5000))
    await expect(service.saveDocument(recovered.id, recovered.revision, false, null)).rejects.toThrow('其他程序修改')
    expect(await readFile(h.target, 'utf8')).toBe('EXTERNAL')
  })

  it('旧格式副本没有保存基线时保持未保存，并支持另存为', async () => {
    await mkdir(join(h.root, 'workcopies'), { recursive: true })
    await writeFile(join(h.root, 'workcopies', 'doc-legacy.json'), JSON.stringify({
      docId: 'doc-legacy', fileName: 'old.md', filePath: null, text: 'LEGACY', revision: 2, savedRevision: 1,
    }))
    const doc = (await service.takeRecovery('doc-legacy'))!
    expect(doc).toMatchObject({ savedText: null, dirty: true })
    await service.saveDocument(doc.id, doc.revision, true, null)
    expect(await readFile(h.target, 'utf8')).toBe('LEGACY')
  })

  it('旧版干净副本可通过文本核验迁移，正常保存无需另存为', async () => {
    await writeFile(h.target, 'LEGACY SAVED')
    await mkdir(join(h.root, 'workcopies'), { recursive: true })
    await writeFile(join(h.root, 'workcopies', 'doc-legacy.json'), JSON.stringify({
      docId: 'doc-legacy', fileName: 'old.md', filePath: h.target, text: 'LEGACY SAVED', revision: 1, savedRevision: 1,
    }))
    const doc = (await service.takeRecovery('doc-legacy'))!
    const revision = service.updateSource(doc.id, doc.revision, 'EDITED').revision
    await service.saveDocument(doc.id, revision, false, null)
    expect(await readFile(h.target, 'utf8')).toBe('EDITED')
  })

  it('旧版脏副本无法核验原文件时明确提示缺少版本信息，避免覆盖外部修改', async () => {
    await writeFile(h.target, 'EXTERNAL')
    await mkdir(join(h.root, 'workcopies'), { recursive: true })
    await writeFile(join(h.root, 'workcopies', 'doc-legacy.json'), JSON.stringify({
      docId: 'doc-legacy', fileName: 'old.md', filePath: h.target, text: 'LEGACY UNSAVED', revision: 2, savedRevision: 1,
    }))
    const doc = (await service.takeRecovery('doc-legacy'))!
    await expect(service.saveDocument(doc.id, doc.revision, false, null)).rejects.toThrow('缺少原文件版本信息')
    expect(await readFile(h.target, 'utf8')).toBe('EXTERNAL')
  })
})

describe('外部改动监听与自动重载', () => {
  it('未修改文档检测到磁盘被外部写入时自动重载', async () => {
    await writeFile(h.target, 'ORIGINAL')
    const doc = (await service.openDocument(null))!
    const events: unknown[] = []
    service.startExternalWatcher((payload) => events.push(payload), 100)

    await writeFile(h.target, 'AI_MODIFIED_TEXT')
    await utimes(h.target, new Date(), new Date(Date.now() + 5000))

    await service.triggerExternalScan()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ docId: doc.id, reloaded: true, text: 'AI_MODIFIED_TEXT' })
    expect(service.getDocumentText(doc.id)).toBe('AI_MODIFIED_TEXT')
    expect(service.getDocumentState(doc.id)?.dirty).toBe(false)
    service.stopExternalWatcher()
  })

  it('存在本地未保存编辑时提示冲突，不静默覆盖本地内容', async () => {
    await writeFile(h.target, 'ORIGINAL')
    const doc = (await service.openDocument(null))!
    service.updateSource(doc.id, doc.revision, 'LOCAL_DIRTY')

    const events: unknown[] = []
    service.startExternalWatcher((payload) => events.push(payload), 100)

    await writeFile(h.target, 'EXTERNAL_AI')
    await utimes(h.target, new Date(), new Date(Date.now() + 5000))

    await service.triggerExternalScan()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ docId: doc.id, reloaded: false, hasConflict: true })
    expect(service.getDocumentText(doc.id)).toBe('LOCAL_DIRTY')

    // 用户确认重新载入磁盘内容
    const reloaded = await service.reloadDocument(doc.id)
    expect(reloaded?.text).toBe('EXTERNAL_AI')
    expect(reloaded?.dirty).toBe(false)
    service.stopExternalWatcher()
  })
})
