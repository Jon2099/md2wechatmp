import { app, dialog, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { watch as fsWatch, type FSWatcher } from 'node:fs'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { DocExternalChangePayload } from '@shared/contracts/ipc'
import type { DocumentState, OpenedDocument, RecoveryHint, SaveResult } from '@shared/models/document'
import { ErrorCode, Md2wError } from '@shared/errors/codes'
import { writeFileAtomic } from '../store/atomic-write'

interface DocEntry extends DocumentState {
  text: string
  savedText: string | null
  filePath: string | null
  mtimeMs: number
}

const docs = new Map<string, DocEntry>()
const fileWatchers = new Map<string, FSWatcher>()
const workTimers = new Map<string, NodeJS.Timeout>()
const workWrites = new Map<string, Promise<void>>()
const saveQueues = new Map<string, Promise<unknown>>()

function toState(entry: DocEntry): DocumentState {
  return {
    id: entry.id,
    fileName: entry.fileName,
    pathLabel: entry.pathLabel,
    revision: entry.revision,
    savedRevision: entry.savedRevision,
    dirty: entry.revision !== entry.savedRevision,
    externalChanged: entry.externalChanged,
    hasFilePath: Boolean(entry.filePath),
  }
}

function toOpened(entry: DocEntry): OpenedDocument {
  return { ...toState(entry), text: entry.text, savedText: entry.savedText }
}

function workcopyDir(): string {
  return join(app.getPath('userData'), 'workcopies')
}

function workcopyPath(docId: string): string {
  return join(workcopyDir(), `${docId}.json`)
}

function persistWorkcopy(entry: DocEntry): Promise<void> {
  const content = JSON.stringify({
    docId: entry.id,
    fileName: entry.fileName,
    filePath: entry.filePath,
    revision: entry.revision,
    savedRevision: entry.savedRevision,
    savedText: entry.savedText,
    mtimeMs: entry.mtimeMs,
    updatedAt: Date.now(),
    text: entry.text,
  })
  const write = (workWrites.get(entry.id) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    await mkdir(workcopyDir(), { recursive: true })
    await writeFileAtomic(workcopyPath(entry.id), content)
  })
  workWrites.set(entry.id, write)
  const cleanup = () => { if (workWrites.get(entry.id) === write) workWrites.delete(entry.id) }
  void write.then(cleanup, cleanup)
  return write
}

function scheduleWorkcopy(entry: DocEntry): void {
  const existing = workTimers.get(entry.id)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    workTimers.delete(entry.id)
    void persistWorkcopy(entry).catch(() => undefined)
  }, 600)
  workTimers.set(entry.id, timer)
}

/** Explicit close must observe persistence failures and wait for queued writes. */
export async function flushWorkcopies(): Promise<void> {
  // Finish requested file saves as well; quitting must not interrupt their IO.
  await Promise.all(Array.from(saveQueues.values(), (saving) => saving.catch(() => undefined)))
  for (const timer of workTimers.values()) clearTimeout(timer)
  workTimers.clear()
  await Promise.all(Array.from(docs.values(), (entry) => persistWorkcopy(entry)))
}

export function createDocument(): OpenedDocument {
  const entry: DocEntry = {
    id: `doc-${randomUUID().replace(/-/g, '').slice(0, 10)}`,
    fileName: '未命名.md',
    pathLabel: '未命名.md',
    revision: 1,
    savedRevision: 0,
    dirty: true,
    externalChanged: false,
    text: '',
    savedText: '',
    filePath: null,
    mtimeMs: 0,
  }
  docs.set(entry.id, entry)
  return toOpened(entry)
}

export function getDocumentText(docId: string): string {
  const entry = docs.get(docId)
  if (!entry) throw new Md2wError(ErrorCode.DocumentMissing, '当前文档不存在，请重新打开。')
  return entry.text
}

export function getDocumentBaseDir(docId: string): string | undefined {
  const path = docs.get(docId)?.filePath
  return path ? dirname(path) : undefined
}

export async function openDocument(window: BrowserWindow | null): Promise<OpenedDocument | null> {
  const options = {
    title: '打开 Markdown',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: '纯文本', extensions: ['txt'] },
    ],
    properties: ['openFile' as const],
  }
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取失败'
    throw new Md2wError(ErrorCode.FileReadFailed, `无法读取文件：${message}`)
  }
  const info = await stat(filePath)

  const entry: DocEntry = {
    id: `doc-${randomUUID().replace(/-/g, '').slice(0, 10)}`,
    fileName: basename(filePath),
    pathLabel: filePath,
    revision: 1,
    savedRevision: 1,
    dirty: false,
    externalChanged: false,
    text,
    savedText: text,
    filePath,
    mtimeMs: info.mtimeMs,
  }
  docs.set(entry.id, entry)
  watchFile(entry)
  void persistWorkcopy(entry).catch(() => undefined)
  return toOpened(entry)
}

export function updateSource(docId: string, baseRevision: number, text: string): { revision: number } {
  const entry = docs.get(docId)
  if (!entry) throw new Md2wError(ErrorCode.DocumentMissing, '当前文档不存在，请重新打开。')
  if (entry.text === text) return { revision: entry.revision }
  entry.text = text
  entry.revision = Math.max(entry.revision, baseRevision) + 1
  scheduleWorkcopy(entry)
  return { revision: entry.revision }
}

export function saveDocument(
  docId: string,
  revision: number,
  saveAs: boolean,
  window: BrowserWindow | null,
): Promise<SaveResult | null> {
  const entry = docs.get(docId)
  if (!entry) return Promise.reject(new Md2wError(ErrorCode.DocumentMissing, '当前文档不存在，请重新打开。'))
  if (entry.revision !== revision) {
    return Promise.reject(new Md2wError(ErrorCode.SnapshotStale, '内容已更新，请重试保存。'))
  }
  const text = entry.text
  const saving = (saveQueues.get(docId) ?? Promise.resolve()).catch(() => undefined).then(
    () => saveRevision(entry, revision, text, saveAs, window),
  )
  saveQueues.set(docId, saving)
  const cleanup = () => { if (saveQueues.get(docId) === saving) saveQueues.delete(docId) }
  void saving.then(cleanup, cleanup)
  return saving
}

async function saveRevision(
  entry: DocEntry, revision: number, text: string, saveAs: boolean, window: BrowserWindow | null,
): Promise<SaveResult | null> {
  let target = entry.filePath
  if (!target || saveAs) {
    const options = {
      title: saveAs ? '另存为' : '保存 Markdown',
      defaultPath: entry.filePath ?? entry.fileName,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    target = result.filePath
  } else {
    const info = await stat(target).catch(() => null)
    if (info && entry.mtimeMs === 0) {
      throw new Md2wError(ErrorCode.FileChanged, '旧版恢复副本缺少原文件版本信息，请另存为以保留原文件。')
    }
    if (info && Math.abs(info.mtimeMs - entry.mtimeMs) > 1) {
      throw new Md2wError(
        ErrorCode.FileChanged,
        '文件已被其他程序修改，请另存为，避免覆盖外部改动。',
      )
    }
  }

  await writeFileAtomic(target, text)
  const info = await stat(target)
  entry.filePath = target
  entry.fileName = basename(target)
  entry.pathLabel = target
  entry.mtimeMs = info.mtimeMs
  entry.savedRevision = revision
  entry.savedText = text
  entry.externalChanged = false
  watchFile(entry)
  void persistWorkcopy(entry).catch(() => undefined)

  return {
    ok: true,
    revision,
    pathLabel: entry.pathLabel,
    fileName: entry.fileName,
  }
}

export function getDocumentState(docId: string): DocumentState | null {
  const entry = docs.get(docId)
  return entry ? toState(entry) : null
}

export async function reloadDocument(docId: string): Promise<OpenedDocument | null> {
  const entry = docs.get(docId)
  if (!entry || !entry.filePath) return null
  let diskText: string
  let info: { mtimeMs: number }
  try {
    diskText = await readFile(entry.filePath, 'utf8')
    info = await stat(entry.filePath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '读取失败'
    throw new Md2wError(ErrorCode.FileReadFailed, `重新载入文件失败：${msg}`)
  }
  entry.text = diskText
  entry.savedText = diskText
  entry.mtimeMs = info.mtimeMs
  entry.revision = entry.revision + 1
  entry.savedRevision = entry.revision
  entry.dirty = false
  entry.externalChanged = false
  void persistWorkcopy(entry).catch(() => undefined)
  return toOpened(entry)
}

function watchFile(entry: DocEntry): void {
  if (!entry.filePath) return
  unwatchFile(entry.id)
  try {
    const w = fsWatch(entry.filePath, () => {
      void triggerExternalScan()
    })
    w.unref?.()
    fileWatchers.set(entry.id, w)
  } catch {
    // 忽略特定文件系统或网络路径的 watch 失败，由轮询兜底
  }
}

function unwatchFile(docId: string): void {
  const w = fileWatchers.get(docId)
  if (w) {
    try { w.close() } catch {}
    fileWatchers.delete(docId)
  }
}

let watcher: NodeJS.Timeout | null = null
let activeEmitter: ((payload: DocExternalChangePayload) => void) | null = null

export async function triggerExternalScan(): Promise<void> {
  if (!activeEmitter) return
  await scanExternalChanges(activeEmitter)
}

async function scanExternalChanges(emit: (payload: DocExternalChangePayload) => void): Promise<void> {
  for (const entry of docs.values()) {
    if (!entry.filePath || entry.mtimeMs === 0) continue
    const info = await stat(entry.filePath).catch(() => null)
    if (!info) continue
    if (Math.abs(info.mtimeMs - entry.mtimeMs) <= 1) continue

    let diskText: string
    try {
      diskText = await readFile(entry.filePath, 'utf8')
    } catch {
      continue
    }

    if (diskText === entry.text) {
      entry.mtimeMs = info.mtimeMs
      entry.externalChanged = false
      continue
    }

    const isDirty = entry.revision !== entry.savedRevision && entry.text !== entry.savedText
    // 未做本地未保存编辑时，自动重载磁盘最新内容并通知前端刷新
    if (!isDirty) {
      entry.text = diskText
      entry.savedText = diskText
      entry.mtimeMs = info.mtimeMs
      entry.revision = entry.revision + 1
      entry.savedRevision = entry.revision
      entry.dirty = false
      entry.externalChanged = false
      void persistWorkcopy(entry).catch(() => undefined)
      emit({
        docId: entry.id,
        reloaded: true,
        text: diskText,
        revision: entry.revision,
        fileName: entry.fileName,
        pathLabel: entry.pathLabel,
      })
    } else if (!entry.externalChanged) {
      // 存在未保存本地编辑时，发出冲突提示，避免静默覆盖
      entry.externalChanged = true
      emit({
        docId: entry.id,
        reloaded: false,
        hasConflict: true,
        fileName: entry.fileName,
        pathLabel: entry.pathLabel,
      })
    }
  }
}

/** 轻量轮询与监听：外部写入时自动重载或提示冲突 */
export function startExternalWatcher(emit: (payload: DocExternalChangePayload) => void, intervalMs = 1200): void {
  activeEmitter = emit
  if (watcher) return
  watcher = setInterval(() => {
    void scanExternalChanges(emit)
  }, intervalMs)
  watcher.unref?.()
}

export function stopExternalWatcher(): void {
  activeEmitter = null
  if (watcher) {
    clearInterval(watcher)
    watcher = null
  }
  for (const w of fileWatchers.values()) {
    try { w.close() } catch {}
  }
  fileWatchers.clear()
}

export function hasDocument(docId: string): boolean {
  return docs.has(docId)
}

export async function takeRecovery(docId: string): Promise<OpenedDocument | null> {
  try {
    const raw = await readFile(workcopyPath(docId), 'utf8')
    const parsed = JSON.parse(raw) as {
      docId: string
      fileName: string
      filePath: string | null
      text: string
      revision: number
      savedRevision: number
      savedText?: string | null
      mtimeMs?: number
    }
    const savedText = parsed.savedText ?? (parsed.revision === parsed.savedRevision ? parsed.text : null)
    let mtimeMs = parsed.mtimeMs ?? 0
    // Old clean copies can be migrated by comparing their saved text. For old
    // dirty copies without any baseline, require Save As rather than guessing.
    if (parsed.filePath && mtimeMs === 0 && savedText !== null) {
      const info = await stat(parsed.filePath).catch(() => null)
      const diskText = await readFile(parsed.filePath, 'utf8').catch(() => null)
      if (info && diskText === savedText) mtimeMs = info.mtimeMs
    }
    const entry: DocEntry = {
      id: parsed.docId,
      fileName: parsed.fileName,
      pathLabel: parsed.filePath ?? parsed.fileName,
      revision: Math.max(parsed.revision, 1),
      savedRevision: Math.max(parsed.savedRevision, 0),
      dirty: parsed.revision !== parsed.savedRevision,
      externalChanged: false,
      text: parsed.text,
      savedText,
      filePath: parsed.filePath,
      mtimeMs,
    }
    docs.set(entry.id, entry)
    return toOpened(entry)
  } catch {
    return null
  }
}

export async function discardRecovery(docId: string): Promise<{ discarded: boolean }> {
  try {
    await writeFileAtomic(workcopyPath(docId), JSON.stringify({ docId, text: '' }))
    return { discarded: true }
  } catch {
    return { discarded: false }
  }
}

export async function listRecoveries(): Promise<RecoveryHint[]> {
  try {
    const dir = workcopyDir()
    const names = await readdir(dir)
    const hints: RecoveryHint[] = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      try {
        const raw = await readFile(join(dir, name), 'utf8')
        const parsed = JSON.parse(raw) as {
          docId: string
          fileName: string
          updatedAt: number
          text: string
          revision: number
          savedRevision: number
        }
        if (!parsed.text || parsed.text.trim().length === 0) continue
        if (docs.has(parsed.docId)) continue
        hints.push({ docId: parsed.docId, fileName: parsed.fileName, updatedAt: parsed.updatedAt })
      } catch {
        continue
      }
    }
    return hints.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 3)
  } catch {
    return []
  }
}
