const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

require('../out/main/index.js')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  await sleep(3000)

  // 1. Close initial help modal if present
  await win.webContents.executeJavaScript(`(() => {
    const btn = document.querySelector('.done-btn')
    if (btn) btn.click()
  })()`)
  await sleep(500)

  // 2. Capture the top-level menubar showing "关于" at the top level
  const brainDir = 'C:/Users/Jonathan/.gemini/antigravity/brain/d9521e6b-735a-4e38-b11e-fd61a7826b5a'
  const menuImg = await win.webContents.capturePage()
  writeFileSync(resolve(brainDir, 'about-top-level-menu.png'), menuImg.toPNG())
  console.log('CAPTURED about-top-level-menu.png')

  // 3. Click "关于" directly on the top-level menubar
  await win.webContents.executeJavaScript(`(() => {
    const aboutBtn = Array.from(document.querySelectorAll('.menu-btn')).find(b => b.textContent.trim() === '关于')
    if (aboutBtn) aboutBtn.click()
  })()`)
  await sleep(600)

  // 4. Capture the modal opened by clicking "关于"
  const modalImg = await win.webContents.capturePage()
  writeFileSync(resolve(brainDir, 'about-modal-direct.png'), modalImg.toPNG())
  console.log('CAPTURED about-modal-direct.png')

  app.exit(0)
})
