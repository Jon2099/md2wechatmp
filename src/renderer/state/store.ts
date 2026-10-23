import { computed, reactive } from 'vue'
import type { AppSettings, OpenedDocument, RecoveryHint } from '@shared/models/document'
import type { CompileOptions, PreviewWidth } from '@shared/models/compile'
import type { ContentSnapshot } from '@shared/models/snapshot'
import type { ThemeId, ThemeProfile, ThemeSummary } from '@shared/models/theme'
import type { Diagnostic } from '@shared/models/diagnostic'
import type { CompileEvent, Md2wBridge } from '@shared/contracts/ipc'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'

type Tone = 'info' | 'ok' | 'warn' | 'error'
type DocumentAction = 'new' | 'open' | 'close'
interface Confirmation {
  action: DocumentAction
  title: string
  description: string
  confirmLabel: string
}

export interface Toast {
  id: number
  tone: Tone
  text: string
}

interface State {
  ready: boolean
  busy: boolean
  confirmation: Confirmation | null
  docId: string | null
  fileName: string
  pathLabel: string
  revision: number
  text: string
  savedText: string | null
  savedRevision: number
  editSeq: number
  compiledSeq: number
  themeId: ThemeId
  themes: ThemeSummary[]
  options: CompileOptions
  previewWidth: PreviewWidth
  snapshot: ContentSnapshot | null
  pending: boolean
  compileError: string | null
  copyState: 'idle' | 'copied' | 'failed'
  copyMessage: string
  toast: Toast | null
  recovery: RecoveryHint | null
  externalConflict: boolean
  showSettings: boolean
  showDiagnostics: boolean
  showThemeModal: boolean
  showThemeEditorModal: boolean
  editingThemeId: string | null
  editingThemeBaseId: string | null
  showHelpModal: boolean
  showAboutModal: boolean
  dismissHelpOnStartup: boolean
}

function readBridge(): Md2wBridge {
  const bridge = window.md2w
  if (!bridge) throw new Error('桌面桥接未就绪。')
  return bridge
}

const state = reactive<State>({
  ready: false,
  busy: false,
  confirmation: null,
  docId: null,
  fileName: '未命名.md',
  pathLabel: '未命名.md',
  revision: 0,
  text: '',
  savedText: '',
  savedRevision: 0,
  editSeq: 0,
  compiledSeq: -1,
  themeId: 'ocean-blue',
  themes: [],
  options: { ...DEFAULT_COMPILE_OPTIONS },
  previewWidth: 375,
  snapshot: null,
  pending: false,
  compileError: null,
  copyState: 'idle',
  copyMessage: '',
  toast: null,
  recovery: null,
  externalConflict: false,
  showSettings: false,
  showDiagnostics: false,
  showThemeModal: false,
  showThemeEditorModal: false,
  editingThemeId: null,
  editingThemeBaseId: null,
  showHelpModal: false,
  showAboutModal: false,
  dismissHelpOnStartup: false,
})

let toastSeq = 0
let toastTimer: ReturnType<typeof setTimeout> | null = null
let compileTimer: ReturnType<typeof setTimeout> | null = null
let copyResetTimer: ReturnType<typeof setTimeout> | null = null
let activeTaskId: string | null = null
let compileGeneration = 0
interface CompileAttempt {
  generation: number
  docId: string
  revision: number
  editSeq: number
  taskId: string | null
}
let activeCompile: CompileAttempt | null = null
let earlyEvents: CompileEvent[] = []
let unsubscribers: Array<() => void> = []
let confirmationResolver: ((confirmed: boolean) => void) | null = null
let documentActionPending = false

const CONFIRMATIONS: Record<DocumentAction, Omit<Confirmation, 'action'>> = {
  new: { title: '尚未保存，仍要新建文档？', description: '当前文档还有未保存的修改。新建后将切换到空白文档，建议先返回编辑并保存。', confirmLabel: '仍然新建' },
  open: { title: '尚未保存，仍要打开其他文件？', description: '当前文档还有未保存的修改。打开其他文件后将离开当前文档，建议先返回编辑并保存。', confirmLabel: '仍然打开' },
  close: { title: '还有修改未保存，确认关闭？', description: '关闭前会保留恢复副本，下次打开应用时可以恢复。当前修改不会写入原文件。', confirmLabel: '保留副本并关闭' },
}

function confirmUnsaved(action: DocumentAction): Promise<boolean> {
  if (!dirty.value) return Promise.resolve(true)
  state.confirmation = { action, ...CONFIRMATIONS[action] }
  return new Promise(resolve => { confirmationResolver = resolve })
}

export function resolveConfirmation(confirmed: boolean): void {
  const resolve = confirmationResolver
  confirmationResolver = null
  state.confirmation = null
  resolve?.(confirmed)
}

async function runDocumentAction(action: DocumentAction, operation: () => Promise<void>): Promise<void> {
  if (state.busy || state.confirmation || documentActionPending) return
  documentActionPending = true
  try {
    if (!await confirmUnsaved(action)) return
    state.busy = true
    await operation()
  } catch (error) {
    notify('error', error instanceof Error ? error.message : '操作失败，请稍后重试。')
  } finally {
    state.busy = false
    documentActionPending = false
    // A native file picker may outlive the editor's pending debounce.
    if (action !== 'close' && state.ready && !state.pending && !snapshotFresh.value) scheduleCompile(0)
  }
}

export const view = state

function notify(tone: Tone, text: string): void {
  toastSeq += 1
  state.toast = { id: toastSeq, tone, text }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    state.toast = null
  }, tone === 'error' ? 5200 : 3200)
}

export function dismissToast(): void {
  state.toast = null
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = null
}

function optionsEqual(left: CompileOptions, right: CompileOptions): boolean {
  return (
    left.includeTitle === right.includeTitle &&
    left.listMode === right.listMode &&
    left.tableFallback === right.tableFallback &&
    left.codeWrap === right.codeWrap &&
    left.firstLineIndent === right.firstLineIndent &&
    left.highlight === right.highlight &&
    left.mathMode === right.mathMode
  )
}

export const snapshotFresh = computed(() => {
  const snapshot = state.snapshot
  if (!snapshot) return false
  return (
    snapshot.docId === state.docId &&
    state.compiledSeq === state.editSeq &&
    snapshot.revision === state.revision &&
    snapshot.themeId === state.themeId &&
    optionsEqual(snapshot.options, state.options)
  )
})

export const canCopy = computed(
  () => snapshotFresh.value && state.snapshot?.status === 'ok' && !state.pending,
)

export const canExport = computed(() => canCopy.value)

export const dirty = computed(() => state.savedText === null || state.text !== state.savedText)

export const diagnostics = computed<Diagnostic[]>(() => state.snapshot?.diagnostics ?? [])

export const diagnosticsSummary = computed(() => {
  const summary = { info: 0, warning: 0, error: 0, review: 0 }
  for (const item of diagnostics.value) {
    summary[item.severity] += 1
    if (item.review) summary.review += 1
  }
  return summary
})

export const statusText = computed(() => {
  if (!state.ready) return '正在初始化…'
  if (state.compileError) return `转换失败：${state.compileError}`
  if (state.pending) return '正在转换…'
  if (!state.snapshot) return '尚未转换'
  if (state.snapshot.status === 'blocked') return '存在阻断错误，无法复制'
  if (!snapshotFresh.value) return '内容已修改，旧结果仅供参考'
  return '结果可用'
})

async function flushSource(): Promise<{ docId: string; revision: number; text: string; editSeq: number } | null> {
  if (!state.docId) return null
  const source = { docId: state.docId, text: state.text, editSeq: state.editSeq }
  const result = await readBridge().updateSource({
    docId: source.docId,
    baseRevision: state.revision,
    text: source.text,
  })
  if (state.docId !== source.docId) return null
  if (!result.ok) {
    state.compileError = result.message
    notify('error', result.message)
    return null
  }
  state.revision = Math.max(state.revision, result.data.revision)
  return { ...source, revision: result.data.revision }
}

export async function compileNow(): Promise<void> {
  if (!state.docId || state.busy) return
  if (compileTimer) clearTimeout(compileTimer)
  compileTimer = null
  const generation = ++compileGeneration
  activeCompile = null
  earlyEvents = []
  state.pending = true
  state.compileError = null
  const source = await flushSource()
  if (generation !== compileGeneration) return
  if (!source || source.editSeq !== state.editSeq) {
    state.pending = false
    return
  }
  const attempt: CompileAttempt = { ...source, generation, taskId: null }
  activeCompile = attempt
  const result = await readBridge().requestCompile({
    docId: source.docId,
    revision: source.revision,
    themeId: state.themeId,
    options: { ...state.options },
  })
  if (generation !== compileGeneration) return
  if (!result.ok) {
    activeCompile = null
    state.pending = false
    state.compileError = result.message
    notify('error', result.message)
    return
  }
  activeTaskId = result.data.taskId
  attempt.taskId = result.data.taskId
  const buffered = earlyEvents
  earlyEvents = []
  for (const event of buffered) handleCompileEvent(event)
}

function handleCompileEvent(event: CompileEvent): void {
  const attempt = activeCompile
  if (!attempt) return
  if (!attempt.taskId) {
    earlyEvents.push(event)
    earlyEvents = earlyEvents.slice(-8)
    return
  }
  if (event.taskId !== attempt.taskId || attempt.docId !== state.docId) return
  if (event.ok) {
    if (event.snapshot.docId !== attempt.docId || event.snapshot.revision !== attempt.revision) return
    state.compiledSeq = attempt.editSeq
    applySnapshot(event.snapshot)
  } else {
    state.pending = false
    state.compileError = event.message
    if (event.code !== 'E_ABORTED') notify('error', event.message)
  }
}

export function scheduleCompile(delay = 320): void {
  if (compileTimer) clearTimeout(compileTimer)
  compileTimer = setTimeout(() => {
    compileTimer = null
    void compileNow()
  }, delay)
}

function applySnapshot(snapshot: ContentSnapshot): void {
  state.snapshot = snapshot
  state.pending = false
  state.compileError = null
  state.copyState = 'idle'
  state.copyMessage = ''
}

function onTextChange(value: string): void {
  if (state.busy || state.confirmation) return
  if (value === state.text) return
  state.text = value
  state.editSeq += 1
  state.copyState = 'idle'
  scheduleCompile()
}

export function setTheme(themeId: ThemeId): void {
  if (state.themeId === themeId) return
  state.themeId = themeId
  void readBridge()
    .updateSettings({ themeId })
    .then((result) => {
      if (!result.ok) notify('warn', result.message)
    })
  scheduleCompile(0)
}

export function setOption<K extends keyof CompileOptions>(key: K, value: CompileOptions[K]): void {
  if (state.options[key] === value) return
  state.options[key] = value
  void readBridge()
    .updateSettings({ options: { [key]: value } })
    .then((result) => {
      if (!result.ok) notify('warn', result.message)
    })
  scheduleCompile(0)
}

export function setPreviewWidth(width: PreviewWidth): void {
  if (state.previewWidth === width) return
  state.previewWidth = width
  void readBridge()
    .updateSettings({ previewWidth: width })
    .then((result) => {
      if (!result.ok) notify('warn', result.message)
    })
}

function adoptDocument(document: OpenedDocument): void {
  compileGeneration += 1
  activeCompile = null
  earlyEvents = []
  state.docId = document.id
  state.fileName = document.fileName
  state.pathLabel = document.pathLabel
  state.revision = document.revision
  state.text = document.text
  state.savedText = document.savedText ?? (document.dirty ? null : document.text)
  state.savedRevision = document.savedRevision
  state.editSeq += 1
  state.snapshot = null
  state.copyState = 'idle'
  state.copyMessage = ''
  state.recovery = null
  scheduleCompile(0)
}

export async function newDocument(): Promise<void> {
  await runDocumentAction('new', async () => {
    const result = await readBridge().createDocument()
    if (!result.ok) {
      notify('error', result.message)
      return
    }
    adoptDocument(result.data)
  })
}

export async function openFile(): Promise<void> {
  await runDocumentAction('open', async () => {
    const result = await readBridge().openDocument()
    if (!result.ok) {
      notify('error', result.message)
      return
    }
    if (!result.data) return
    adoptDocument(result.data)
    notify('info', `已打开 ${result.data.fileName}`)
  })
}

export async function save(saveAs = false): Promise<void> {
  if (!state.docId || state.busy || state.confirmation) return
  const source = await flushSource()
  if (!source) return
  const bridge = readBridge()
  const result = saveAs
    ? await bridge.saveDocumentAs({ docId: source.docId, revision: source.revision })
    : await bridge.saveDocument({ docId: source.docId, revision: source.revision })
  if (state.docId !== source.docId) return
  if (!result.ok) {
    notify('error', result.message)
    return
  }
  if (!result.data) return
  if (result.data.revision < state.savedRevision) return
  const locationChanged = state.pathLabel !== result.data.pathLabel
  state.fileName = result.data.fileName
  state.pathLabel = result.data.pathLabel
  state.revision = Math.max(state.revision, result.data.revision)
  state.savedRevision = result.data.revision
  state.savedText = source.text
  if (locationChanged) {
    state.compiledSeq = -1
    scheduleCompile(0)
  }
  notify('ok', `已保存 ${result.data.fileName}`)
}

export async function requestClose(): Promise<void> {
  await runDocumentAction('close', async () => {
    if (compileTimer) clearTimeout(compileTimer)
    compileTimer = null
    const source = state.docId ? await flushSource() : null
    if (state.docId && !source) return
    const result = await readBridge().completeClose({ docId: source?.docId ?? null, revision: source?.revision ?? 0 })
    if (!result.ok) notify('error', result.message)
  })
}

export async function copyToWechat(): Promise<void> {
  const snapshot = state.snapshot
  if (!snapshot || !canCopy.value) {
    notify('warn', '请等待转换完成后再复制。')
    return
  }
  const result = await readBridge().copySnapshot({
    snapshotId: snapshot.id,
    expectedRevision: snapshot.revision,
  })
  if (!result.ok) {
    state.copyState = 'failed'
    state.copyMessage = result.message
    notify('error', result.message)
    return
  }
  state.copyState = result.data.verified ? 'copied' : 'failed'
  state.copyMessage = result.data.message
  notify(result.data.verified ? 'ok' : 'warn', result.data.message)
  if (copyResetTimer) clearTimeout(copyResetTimer)
  if (state.copyState === 'copied') {
    copyResetTimer = setTimeout(() => {
      copyResetTimer = null
      if (state.copyState === 'copied') {
        state.copyState = 'idle'
      }
    }, 2000)
  }
}

export async function exportHtml(includeCopyButton: boolean): Promise<void> {
  const snapshot = state.snapshot
  if (!snapshot || !canExport.value) {
    notify('warn', '请等待转换完成后再导出。')
    return
  }
  const result = await readBridge().exportHtml({
    snapshotId: snapshot.id,
    expectedRevision: snapshot.revision,
    includeCopyButton,
  })
  if (!result.ok) {
    notify('error', result.message)
    return
  }
  if (!result.data.saved) return
  notify('ok', `已导出 ${result.data.fileName ?? 'HTML'}`)
}

export async function acceptRecovery(): Promise<void> {
  const hint = state.recovery
  if (!hint) return
  const result = await readBridge().takeRecovery({ docId: hint.docId })
  if (!result.ok) {
    notify('error', result.message)
    return
  }
  if (!result.data) {
    notify('warn', '未找到可恢复的内容。')
    state.recovery = null
    return
  }
  adoptDocument(result.data)
  notify('ok', `已恢复 ${result.data.fileName}`)
}

export async function discardRecovery(): Promise<void> {
  const hint = state.recovery
  if (!hint) return
  state.recovery = null
  const result = await readBridge().discardRecovery({ docId: hint.docId })
  if (!result.ok) notify('warn', result.message)
}

export function toggleSettings(force?: boolean): void {
  state.showSettings = force ?? !state.showSettings
}

export function toggleThemeModal(force?: boolean): void {
  state.showThemeModal = force ?? !state.showThemeModal
}

export function openThemeEditor(themeId?: string, baseThemeId?: string): void {
  state.editingThemeId = themeId ?? null
  state.editingThemeBaseId = baseThemeId ?? (themeId ? null : state.themeId)
  state.showThemeEditorModal = true
}

export function closeThemeEditor(): void {
  state.showThemeEditorModal = false
  state.editingThemeId = null
  state.editingThemeBaseId = null
}

export async function refreshThemes(): Promise<void> {
  const themesResult = await readBridge().listThemes()
  if (themesResult.ok) state.themes = themesResult.data
}

export async function saveCustomTheme(profile: ThemeProfile): Promise<boolean> {
  try {
    // ThemeProfile 是 JSON 数据；深拷贝为普通对象，避免把嵌套 Vue Proxy 传入 IPC。
    const payload = JSON.parse(JSON.stringify(profile)) as ThemeProfile
    const result = await readBridge().saveCustomTheme(payload)
    if (!result.ok) {
      notify('error', result.message || '保存自定义主题失败')
      return false
    }
    await refreshThemes()
    if (state.themeId === result.data.id) {
      // 编辑正在使用的主题时，ID 不变，但旧排版已经失效。
      state.compiledSeq = -1
      scheduleCompile(0)
    } else {
      setTheme(result.data.id)
    }
    notify('ok', `主题「${result.data.name}」已保存并应用`)
    closeThemeEditor()
    return true
  } catch (error) {
    notify('error', `保存或应用自定义主题失败：${error instanceof Error ? error.message : '请稍后重试'}`)
    return false
  }
}

export async function deleteCustomTheme(themeId: string): Promise<boolean> {
  const result = await readBridge().deleteCustomTheme(themeId)
  if (!result.ok) {
    notify('error', result.message || '删除自定义主题失败')
    return false
  }
  await refreshThemes()
  if (state.themeId === themeId) {
    setTheme('ocean-blue')
  }
  notify('info', '自定义主题已删除')
  return true
}

export function toggleDiagnostics(force?: boolean): void {
  state.showDiagnostics = force ?? !state.showDiagnostics
}

export function toggleHelpModal(force?: boolean): void {
  state.showHelpModal = force ?? !state.showHelpModal
}

export function toggleAboutModal(force?: boolean): void {
  state.showAboutModal = force ?? !state.showAboutModal
}

export function setDismissHelpOnStartup(dismiss: boolean): void {
  state.dismissHelpOnStartup = dismiss
  void readBridge()
    .updateSettings({ dismissHelpOnStartup: dismiss })
    .then((result) => {
      if (!result.ok) notify('warn', result.message)
    })
}

export function handleMenuAction(action: string): void {
  if (state.busy || state.confirmation) return
  if (action === 'file:new') void newDocument()
  else if (action === 'file:open') void openFile()
  else if (action === 'file:save') void save(false)
  else if (action === 'file:save-as') void save(true)
  else if (action === 'file:export-html') void exportHtml(true)
  else if (action === 'edit:recompile') void compileNow()
  else if (action === 'edit:copy-wechat') void copyToWechat()
  else if (action.startsWith('view:preview-width:')) {
    const width = Number(action.split(':')[2]) as PreviewWidth
    setPreviewWidth(width)
  } else if (action === 'theme:open-modal') {
    toggleThemeModal(true)
  } else if (action === 'theme:open-editor') {
    openThemeEditor()
  } else if (action.startsWith('theme:select:')) {
    const themeId = action.split(':')[2] as ThemeId
    setTheme(themeId)
  } else if (action === 'options:open-settings') {
    toggleSettings(true)
  } else if (action === 'options:open-diagnostics') {
    toggleDiagnostics(true)
  } else if (action === 'options:open-help' || action === 'help:open-help') {
    toggleHelpModal(true)
  } else if (action === 'help:open-about') {
    toggleAboutModal(true)
  }
}

export { onTextChange }

export async function init(): Promise<void> {
  const bridge = readBridge()
  unsubscribers.push(
    bridge.onCloseRequested(() => { void requestClose() }),
    bridge.onCompileResult(handleCompileEvent),
    bridge.onRecoveryAvailable((hint) => {
      if (!state.recovery) state.recovery = hint
    }),
    bridge.onExternalChange((payload) => {
      if (payload.docId !== state.docId) return
      if (payload.reloaded && typeof payload.text === 'string') {
        state.text = payload.text
        state.savedText = payload.text
        if (typeof payload.revision === 'number') {
          state.revision = payload.revision
          state.savedRevision = payload.revision
        }
        if (payload.fileName) state.fileName = payload.fileName
        if (payload.pathLabel) state.pathLabel = payload.pathLabel
        state.editSeq += 1
        state.externalConflict = false
        scheduleCompile(0)
        notify('info', '检测到外部写入，已自动刷新内容。')
      } else if (payload.hasConflict) {
        state.externalConflict = true
        notify('warn', '磁盘文件已被外部（如 AI）修改，当前有未保存的本地改动。')
      } else {
        notify('warn', '文件已在应用外部被修改，保存时请选择「另存为」，避免覆盖外部改动。')
      }
    }),
    bridge.onMenuAction((action) => {
      handleMenuAction(action)
    }),
  )

  const settingsResult = await bridge.getSettings()
  if (settingsResult.ok) applySettings(settingsResult.data)

  if (!state.dismissHelpOnStartup) {
    state.showHelpModal = true
  }

  const themesResult = await bridge.listThemes()
  if (themesResult.ok) state.themes = themesResult.data

  const documentResult = await bridge.createDocument()
  if (!documentResult.ok) {
    notify('error', documentResult.message)
    state.ready = true
    return
  }
  adoptDocument(documentResult.data)
  state.ready = true
}

export async function reloadExternal(): Promise<void> {
  if (!state.docId) return
  const bridge = readBridge()
  state.busy = true
  try {
    const result = await bridge.reloadDocument({ docId: state.docId })
    if (result.ok && result.data) {
      adoptDocument(result.data)
      state.externalConflict = false
      notify('ok', '已重新载入磁盘最新内容')
    } else if (!result.ok) {
      notify('error', result.message)
    }
  } finally {
    state.busy = false
  }
}

export function ignoreExternalConflict(): void {
  state.externalConflict = false
}

function applySettings(settings: AppSettings): void {
  state.themeId = settings.themeId as ThemeId
  state.options = { ...settings.options }
  state.previewWidth = settings.previewWidth
  state.dismissHelpOnStartup = Boolean(settings.dismissHelpOnStartup)
}

export function dispose(): void {
  state.ready = false
  resolveConfirmation(false)
  for (const off of unsubscribers) off()
  unsubscribers = []
  if (compileTimer) clearTimeout(compileTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (copyResetTimer) clearTimeout(copyResetTimer)
  compileTimer = null
  toastTimer = null
  copyResetTimer = null
  activeTaskId = null
  compileGeneration += 1
  activeCompile = null
  earlyEvents = []
}

export function currentTaskId(): string | null {
  return activeTaskId
}
