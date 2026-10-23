import { app, session } from 'electron'

/** 应用窗口与预览内容都不允许导航、开新窗口或申请系统权限 */
export function installSecurity(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event) => {
      event.preventDefault()
    })
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  session.defaultSession.setPermissionCheckHandler(() => false)
}
