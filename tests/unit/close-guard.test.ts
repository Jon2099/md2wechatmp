import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/contracts/ipc'
import { finishWindowClose, installCloseGuard } from '../../src/main/close-guard'

it('所有原生关闭入口在确认和持久化完成前都被拦截', () => {
  const preventDefault = vi.fn()
  const window = Object.assign(new EventEmitter(), {
    webContents: { send: vi.fn() },
    close: vi.fn(() => { window.emit('close', { preventDefault }) }),
  })
  installCloseGuard(window as unknown as BrowserWindow)
  window.close()
  window.close()
  expect(preventDefault).toHaveBeenCalledTimes(2)
  expect(window.webContents.send).toHaveBeenCalledWith(CHANNELS.windowCloseRequested)
  finishWindowClose(window as unknown as BrowserWindow)
  expect(preventDefault).toHaveBeenCalledTimes(2)
})
