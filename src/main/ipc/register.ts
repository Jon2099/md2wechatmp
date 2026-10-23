import { ipcMain, type BrowserWindow } from 'electron'
import { ZodError, type ZodType } from 'zod'
import { ErrorCode, toErrorPayload } from '@shared/errors/codes'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function trusted(event: Electron.IpcMainInvokeEvent): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  return event.sender === mainWindow.webContents
}

export function handle<T>(
  channel: string,
  schema: ZodType<unknown> | null,
  fn: (payload: unknown) => Promise<T> | T,
): void {
  ipcMain.handle(channel, async (event, payload) => {
    if (!trusted(event)) {
      return { ok: false, code: ErrorCode.InvalidInput, message: '请求来源不可信。' }
    }
    try {
      const parsed = schema ? schema.parse(payload ?? {}) : payload
      const data = await fn(parsed)
      return { ok: true, data }
    } catch (error) {
      if (error instanceof ZodError) {
        return { ok: false, code: ErrorCode.InvalidInput, message: '请求参数不合法。' }
      }
      return toErrorPayload(error)
    }
  })
}

export function emitToRenderer(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}
