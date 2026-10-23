import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '@shared/contracts/ipc'
import type { CompileEvent, Md2wBridge } from '@shared/contracts/ipc'

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload ?? {}) as Promise<T>
}

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const bridge: Md2wBridge = {
  createDocument: () => invoke(CHANNELS.docNew),
  openDocument: () => invoke(CHANNELS.docOpen),
  reloadDocument: (request) => invoke(CHANNELS.docReload, request),
  updateSource: (request) => invoke(CHANNELS.docUpdate, request),
  saveDocument: (request) => invoke(CHANNELS.docSave, request),
  saveDocumentAs: (request) => invoke(CHANNELS.docSaveAs, request),
  requestCompile: (request) => invoke(CHANNELS.compileRequest, request),
  cancelCompile: (request) => invoke(CHANNELS.compileCancel, request),
  copySnapshot: (request) => invoke(CHANNELS.clipboardCopy, request),
  exportHtml: (request) => invoke(CHANNELS.exportHtml, request),
  listThemes: () => invoke(CHANNELS.themeList),
  getTheme: (id) => invoke(CHANNELS.themeGet, { id }),
  saveCustomTheme: (profile) => invoke(CHANNELS.themeSaveCustom, profile),
  deleteCustomTheme: (id) => invoke(CHANNELS.themeDeleteCustom, { id }),
  getSettings: () => invoke(CHANNELS.settingsGet),
  updateSettings: (patch) => invoke(CHANNELS.settingsUpdate, patch),
  takeRecovery: (request) => invoke(CHANNELS.recoveryTake, request),
  discardRecovery: (request) => invoke(CHANNELS.recoveryDiscard, request),
  onCompileResult: (callback) => subscribe<CompileEvent>(CHANNELS.compileResult, callback),
  onExternalChange: (callback) => subscribe(CHANNELS.docExternalChange, callback),
  onRecoveryAvailable: (callback) => subscribe(CHANNELS.recoveryAvailable, callback),
  onMenuAction: (callback) => subscribe<string>(CHANNELS.menuAction, callback),
  minimizeWindow: () => invoke(CHANNELS.windowMinimize),
  maximizeWindow: () => invoke(CHANNELS.windowMaximize),
  closeWindow: () => invoke(CHANNELS.windowClose),
  completeClose: (request) => invoke(CHANNELS.windowCloseComplete, request),
  onCloseRequested: (callback) => subscribe(CHANNELS.windowCloseRequested, callback),
  isWindowMaximized: () => invoke(CHANNELS.windowIsMaximized),
  onMaximizedChange: (callback) => subscribe<boolean>(CHANNELS.windowMaximizedChange, callback),
}

contextBridge.exposeInMainWorld('md2w', bridge)
