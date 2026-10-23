import { CHANNELS } from '@shared/contracts/ipc'
import { getMainWindow, handle } from './register'
import { closeRequestSchema } from '@shared/schemas/ipc'
import { ErrorCode, Md2wError } from '@shared/errors/codes'
import { flushWorkcopies, getDocumentState } from '../services/document-service'
import { finishWindowClose } from '../close-guard'

export function registerWindowIpc(): void {
  handle(CHANNELS.windowMinimize, null, () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.minimize()
    }
    return null
  })

  handle(CHANNELS.windowMaximize, null, () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) {
        win.unmaximize()
        return false
      } else {
        win.maximize()
        return true
      }
    }
    return false
  })

  handle(CHANNELS.windowClose, null, () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
    return null
  })

  handle(CHANNELS.windowCloseComplete, closeRequestSchema, async (payload) => {
    const request = payload as { docId: string | null; revision: number }
    const win = getMainWindow()
    const checkRevision = () => {
      if (request.docId && getDocumentState(request.docId)?.revision !== request.revision) {
        throw new Md2wError(ErrorCode.SnapshotStale, '内容已更新，请重试关闭。')
      }
    }
    checkRevision()
    await flushWorkcopies()
    checkRevision()
    if (win && !win.isDestroyed()) finishWindowClose(win)
    return null
  })

  handle(CHANNELS.windowIsMaximized, null, () => {
    const win = getMainWindow()
    return win && !win.isDestroyed() ? win.isMaximized() : false
  })
}
