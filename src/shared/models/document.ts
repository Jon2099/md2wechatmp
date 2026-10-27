import type { CompileOptions, PreviewWidth } from './compile'

export interface DocumentState {
  id: string
  fileName: string
  /** 仅用于界面显示，完整路径不会进入剪贴板或导出内容 */
  pathLabel: string
  revision: number
  savedRevision: number
  dirty: boolean
  externalChanged: boolean
  hasFilePath?: boolean
}

export interface OpenedDocument extends DocumentState {
  text: string
  /** null means that a legacy recovery has no known saved baseline. */
  savedText: string | null
}

export interface SaveResult {
  ok: true
  revision: number
  pathLabel: string
  fileName: string
}

export interface RecoveryHint {
  docId: string
  fileName: string
  updatedAt: number
}

export interface AppSettings {
  schemaVersion: number
  themeId: string
  options: CompileOptions
  previewWidth: PreviewWidth
  lastFilePath: string | null
  dismissHelpOnStartup?: boolean
  autoSaveInterval?: number
}
