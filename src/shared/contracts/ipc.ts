import type { ContentSnapshot } from '../models/snapshot'
import type {
  AppSettings,
  OpenedDocument,
  RecoveryHint,
  SaveResult,
} from '../models/document'
import type { CompileOptions, CompileRequest, PreviewWidth } from '../models/compile'
import type { ThemeId, ThemeSummary } from '../models/theme'
import type { ErrorPayload } from '../errors/codes'

export const CHANNELS = {
  docNew: 'md2w:doc:new',
  docOpen: 'md2w:doc:open',
  docUpdate: 'md2w:doc:update',
  docSave: 'md2w:doc:save',
  docSaveAs: 'md2w:doc:save-as',
  docReload: 'md2w:doc:reload',
  docExternalChange: 'md2w:doc:external-change',
  compileRequest: 'md2w:compile:request',
  compileCancel: 'md2w:compile:cancel',
  compileResult: 'md2w:compile:result',
  clipboardCopy: 'md2w:clipboard:copy',
  exportHtml: 'md2w:export:html',
  themeList: 'md2w:theme:list',
  settingsGet: 'md2w:settings:get',
  settingsUpdate: 'md2w:settings:update',
  recoveryAvailable: 'md2w:recovery:available',
  recoveryTake: 'md2w:recovery:take',
  recoveryDiscard: 'md2w:recovery:discard',
  menuAction: 'md2w:menu:action',
  windowMinimize: 'md2w:window:minimize',
  windowMaximize: 'md2w:window:maximize',
  windowClose: 'md2w:window:close',
  windowCloseRequested: 'md2w:window:close-requested',
  windowCloseComplete: 'md2w:window:close-complete',
  windowIsMaximized: 'md2w:window:is-maximized',
  windowMaximizedChange: 'md2w:window:maximized-change',
} as const

export type IpcResult<T> = { ok: true; data: T } | ErrorPayload

export interface CopyResult {
  verified: boolean
  message: string
  placeholders: number
  reviewItems: number
}

export interface ExportResult {
  saved: boolean
  pathLabel?: string
  fileName?: string
}

export type CompileEvent =
  | { ok: true; taskId: string; snapshot: ContentSnapshot }
  | { ok: false; taskId: string; code: string; message: string }

export interface UpdateSourceRequest {
  docId: string
  baseRevision: number
  text: string
}

export interface CopyRequest {
  snapshotId: string
  expectedRevision: number
}

export interface ExportRequest extends CopyRequest {
  includeCopyButton: boolean
}

export interface CancelRequest {
  taskId: string
}

export interface SettingsPatch {
  themeId?: ThemeId
  options?: Partial<CompileOptions>
  previewWidth?: PreviewWidth
  lastFilePath?: string | null
  dismissHelpOnStartup?: boolean
}

export interface DocExternalChangePayload {
  docId: string
  reloaded?: boolean
  text?: string
  revision?: number
  fileName?: string
  pathLabel?: string
  hasConflict?: boolean
}

export interface Md2wBridge {
  createDocument(): Promise<IpcResult<OpenedDocument>>
  openDocument(): Promise<IpcResult<OpenedDocument | null>>
  reloadDocument(req: { docId: string }): Promise<IpcResult<OpenedDocument | null>>
  updateSource(req: UpdateSourceRequest): Promise<IpcResult<{ revision: number }>>
  saveDocument(req: { docId: string; revision: number }): Promise<IpcResult<SaveResult | null>>
  saveDocumentAs(req: { docId: string; revision: number }): Promise<IpcResult<SaveResult | null>>
  requestCompile(req: CompileRequest): Promise<IpcResult<{ taskId: string }>>
  cancelCompile(req: CancelRequest): Promise<IpcResult<{ cancelled: boolean }>>
  copySnapshot(req: CopyRequest): Promise<IpcResult<CopyResult>>
  exportHtml(req: ExportRequest): Promise<IpcResult<ExportResult>>
  listThemes(): Promise<IpcResult<ThemeSummary[]>>
  getSettings(): Promise<IpcResult<AppSettings>>
  updateSettings(patch: SettingsPatch): Promise<IpcResult<AppSettings>>
  takeRecovery(req: { docId: string }): Promise<IpcResult<OpenedDocument | null>>
  discardRecovery(req: { docId: string }): Promise<IpcResult<{ discarded: boolean }>>
  onCompileResult(cb: (event: CompileEvent) => void): () => void
  onExternalChange(cb: (payload: DocExternalChangePayload) => void): () => void
  onRecoveryAvailable(cb: (hint: RecoveryHint) => void): () => void
  onMenuAction(cb: (action: string) => void): () => void
  minimizeWindow(): Promise<void>
  maximizeWindow(): Promise<boolean>
  closeWindow(): Promise<void>
  completeClose(req: { docId: string | null; revision: number }): Promise<IpcResult<null>>
  onCloseRequested(cb: () => void): () => void
  isWindowMaximized(): Promise<boolean>
  onMaximizedChange(cb: (maximized: boolean) => void): () => void
}
