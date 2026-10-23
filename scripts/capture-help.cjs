const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

require('../out/main/index.js')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  await sleep(3500)

  // 1. Capture Help Modal
  const brainDir = 'C:/Users/Jonathan/.gemini/antigravity/brain/d9521e6b-735a-4e38-b11e-fd61a7826b5a'
  const helpImg = await win.webContents.capturePage()
  writeFileSync(resolve(brainDir, 'ui-help-highlighted.png'), helpImg.toPNG())
  console.log('CAPTURED ui-help-highlighted.png')

  // 2. Close help modal
  await win.webContents.executeJavaScript(`(() => {
    const btn = document.querySelector('.done-btn')
    if (btn) btn.click()
  })()`)
  await sleep(600)

  const cleanTitleImg = await win.webContents.capturePage()
  writeFileSync(resolve(brainDir, 'titlebar-clean.png'), cleanTitleImg.toPNG())
  console.log('CAPTURED titlebar-clean.png')

  app.exit(0)
})
