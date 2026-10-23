import { app, BrowserWindow, Menu, protocol } from 'electron'
import { VIDEO_PREVIEW_SCHEME } from '@shared/video-policy'
import { CHANNELS } from '@shared/contracts/ipc'
import { WorkerHost } from './jobs/worker-host'
import { CompileService } from './services/compile-service'
import { listRecoveries, startExternalWatcher, stopExternalWatcher, triggerExternalScan } from './services/document-service'
import { registerClipboardIpc } from './ipc/clipboard'
import { registerCompileIpc } from './ipc/compile'
import { registerDocumentIpc } from './ipc/document'
import { registerExportIpc } from './ipc/export'
import { registerSettingsIpc } from './ipc/settings'
import { registerWindowIpc } from './ipc/window'
import { emitToRenderer, setMainWindow } from './ipc/register'
import { installSecurity } from './security'
import { createMainWindow } from './window'
import { VideoPreviewService } from './services/video-preview-service'

protocol.registerSchemesAsPrivileged([{
  scheme: VIDEO_PREVIEW_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}])
const videoPreview = new VideoPreviewService()

let workerHost: WorkerHost | null = null
let compileService: CompileService | null = null

function bootstrap(): void {
  installSecurity()
  protocol.handle(VIDEO_PREVIEW_SCHEME, request => videoPreview.respond(request))
  Menu.setApplicationMenu(null)
  registerWindowIpc()
  registerDocumentIpc()
  registerExportIpc()
  registerSettingsIpc()
  registerClipboardIpc()

  workerHost = new WorkerHost()
  compileService = new CompileService(workerHost, (event) => {
    emitToRenderer(CHANNELS.compileResult, event)
  }, (snapshot, baseDir) => videoPreview.prepare(snapshot, baseDir))
  registerCompileIpc(compileService)

  startExternalWatcher((payload) => {
    emitToRenderer(CHANNELS.docExternalChange, payload)
  })
}

async function announceRecoveries(): Promise<void> {
  const hints = await listRecoveries()
  for (const hint of hints) {
    emitToRenderer(CHANNELS.recoveryAvailable, hint)
  }
}

function spawnWindow(): void {
  const window = createMainWindow()
  setMainWindow(window)
  window.on('closed', () => setMainWindow(null))
  window.on('focus', () => {
    void triggerExternalScan()
  })
  window.webContents.on('did-finish-load', () => {
    void announceRecoveries()
  })
}

// 单实例：重复启动时聚焦已有窗口，避免多个实例争抢同一份工作副本。
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const first = BrowserWindow.getAllWindows()[0]
    if (!first) return
    if (first.isMinimized()) first.restore()
    first.focus()
  })

  app.whenReady().then(() => {
    bootstrap()
    spawnWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) spawnWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    stopExternalWatcher()
    compileService?.dispose()
    workerHost?.dispose()
    videoPreview.clear()
    compileService = null
    workerHost = null
  })
}
