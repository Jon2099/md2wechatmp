const { app, BrowserWindow } = require('electron')
const { writeFileSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')

require('../out/main/index.js')

const SAMPLE = readFileSync(resolve(__dirname, '../tests/fixtures/b300-backpay.md'), 'utf8')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  await sleep(3500)

  await win.webContents.executeJavaScript(`(async () => {
    const bridge = window.md2w
    const created = await bridge.createDocument()
    const docId = created.data.id
    const updated = await bridge.updateSource({ docId, baseRevision: created.data.revision, text: ${JSON.stringify(SAMPLE)} })
    await bridge.requestCompile({
      docId,
      revision: updated.data.revision,
      themeId: 'magazine',
      options: { listMode: 'native', tableFallback: 'none', codeWrap: 'soft', firstLineIndent: false, highlight: true, mathMode: 'svg' },
    })
    return true
  })()`)

  await sleep(3000)

  // 1. Capture top view
  const topImage = await win.webContents.capturePage()
  writeFileSync(resolve('out/magazine-optimized-top.png'), topImage.toPNG())

  // 2. Scroll iframe down to show the middle callout card
  await win.webContents.executeJavaScript(`(() => {
    const iframe = document.querySelector('iframe')
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.scrollTo(0, 1100)
    }
  })()`)
  await sleep(1500)

  const middleImage = await win.webContents.capturePage()
  writeFileSync(resolve('out/magazine-optimized-middle.png'), middleImage.toPNG())

  console.log('CAPTURES COMPLETED')
  app.exit(0)
})
