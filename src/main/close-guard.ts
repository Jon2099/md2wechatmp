import type { BrowserWindow } from 'electron'
import { CHANNELS } from '@shared/contracts/ipc'

const approved = new WeakSet<BrowserWindow>()

/** Covers both the custom close button and OS close/quit requests. */
export function installCloseGuard(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (approved.has(window)) return
    event.preventDefault()
    window.webContents.send(CHANNELS.windowCloseRequested)
  })
}

export function finishWindowClose(window: BrowserWindow): void {
  approved.add(window)
  window.close()
}
