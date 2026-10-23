const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

require('../out/main/index.js')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  await sleep(3000)

  // Close initial help modal if present
  await win.webContents.executeJavaScript(`(() => {
    const btn = document.querySelector('.done-btn')
    if (btn) btn.click()
  })()`)
  await sleep(500)

  // Capture the window to verify document title centering
  const brainDir = 'C:/Users/Jonathan/.gemini/antigravity/brain/d9521e6b-735a-4e38-b11e-fd61a7826b5a'
  const titleImg = await win.webContents.capturePage()
  writeFileSync(resolve(brainDir, 'titlebar-centered-verified.png'), titleImg.toPNG())
  console.log('CAPTURED titlebar-centered-verified.png')

  app.exit(0)
})
