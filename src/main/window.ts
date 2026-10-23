import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { CHANNELS } from '@shared/contracts/ipc'
import { emitToRenderer } from './ipc/register'
import { installCloseGuard } from './close-guard'

export function createMainWindow(): BrowserWindow {
  const icon = app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(__dirname, '../../build/icon.png')
  const window = new BrowserWindow({
    icon,
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    frame: false,
    title: '排版助手',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })

  installCloseGuard(window)
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(icon)

  window.on('maximize', () => {
    emitToRenderer(CHANNELS.windowMaximizedChange, true)
  })
  window.on('unmaximize', () => {
    emitToRenderer(CHANNELS.windowMaximizedChange, false)
  })

  window.once('ready-to-show', () => window.show())

  // 调试启动（debug.py）会带这个环境变量，让 DevTools 跟着窗口一起打开。
  const devtoolsMode = process.env.MD2W_DEVTOOLS
  if (devtoolsMode) {
    const mode = devtoolsMode === 'right' ? 'right' : 'detach'
    window.webContents.once('did-finish-load', () => window.webContents.openDevTools({ mode }))
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
