/**
 * 端到端冒烟：加载真实主进程入口，通过页面里的桥接跑一遍「建文档 → 写源文 → 转换」，
 * 再读回界面状态与预览壳，确认 IPC 校验、转换进程、渲染层链路都在工作。
 *
 * 用法：env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/smoke-app.cjs
 */
const { app, BrowserWindow } = require('electron')

require('../out/main/index.js')

const SAMPLE = `# 冒烟样稿

这是一段**正文**，用来确认转换链路。

> **核心结论**
> · 第一点
> · 第二点

| 指标 | 数值 | 说明 |
| --- | --- | --- |
| 字符 | 100 | 估算 |
| 表格 | 1 | 单表 |

![架构图](https://example.com/images/architecture.png)

参考 [微信公众平台](https://mp.weixin.qq.com) 的排版规则。

\`\`\`ts
const value = 1
\`\`\`
`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) {
    console.log('PROBE_APP no-window')
    app.exit(1)
    return
  }

  const consoleMessages = []
  win.webContents.on('console-message', (event) => {
    const text = typeof event === 'object' && event.message ? event.message : String(event)
    consoleMessages.push(text)
  })

  await sleep(6000)

  const bridgeCheck = await win.webContents.executeJavaScript(`(async () => {
    const bridge = window.md2w
    if (!bridge) return { error: 'no-bridge' }
    const created = await bridge.createDocument()
    if (!created.ok) return { error: 'create-failed', detail: created }
    const docId = created.data.id
    const updated = await bridge.updateSource({ docId, baseRevision: created.data.revision, text: ${JSON.stringify(SAMPLE)} })
    if (!updated.ok) return { error: 'update-failed', detail: updated }
    const compiled = await bridge.requestCompile({
      docId,
      revision: updated.data.revision,
      themeId: 'ocean-blue',
      options: { listMode: 'native', tableFallback: 'none', codeWrap: 'soft', firstLineIndent: false, highlight: true, mathMode: 'svg' },
    })
    if (!compiled.ok) return { error: 'compile-failed', detail: compiled }
    return { docId, revision: updated.data.revision, taskId: compiled.data.taskId }
  })()`)

  await sleep(3000)

  const ui = await win.webContents.executeJavaScript(`(() => {
    const frame = document.querySelector('iframe')
    const srcdoc = frame ? frame.getAttribute('srcdoc') || '' : ''
    return {
      status: (document.querySelector('.status-text') || {}).textContent || null,
      chips: Array.from(document.querySelectorAll('.chip')).map((el) => el.textContent.trim()),
      diagnostics: Array.from(document.querySelectorAll('.diag-item .message')).map((el) => el.textContent.trim()),
      previewLength: srcdoc.length,
      previewHasTable: srcdoc.includes('<table'),
      previewHasImage: srcdoc.includes('<img ') && srcdoc.includes('https://example.com/images/architecture.png'),
      previewHasClass: /class=/.test(srcdoc),
      copyDisabled: document.querySelector('.primary') ? document.querySelector('.primary').disabled : null,
      sandbox: frame ? frame.getAttribute('sandbox') : null,
    }
  })()`)

  console.log('PROBE_APP ' + JSON.stringify({ bridgeCheck, ui, consoleMessages: consoleMessages.slice(0, 12) }))
  app.exit(0)
})
