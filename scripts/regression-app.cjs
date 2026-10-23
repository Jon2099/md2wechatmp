/** Native regressions use their own userData directory; no user files or dialogs. */
const { app, BrowserWindow, dialog, session, clipboard } = require('electron')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const http = require('node:http')

const testRoot = path.resolve(__dirname, '../tests/.tmp')
fsSync.mkdirSync(testRoot, { recursive: true })
const dataDir = fsSync.mkdtempSync(path.join(testRoot, 'electron-'))
app.setPath('userData', dataDir)
app.on('browser-window-created', (_event, win) => {
  win.show = () => {}
  win.webContents.backgroundThrottling = false
})
// Keep the test harness alive after the production close path finishes.
app.on('before-quit', (event) => event.preventDefault())
const timeout = setTimeout(() => { console.error('ELECTRON_REGRESSION timeout'); app.exit(1) }, 45000)
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn, label) {
  const deadline = Date.now() + 12000
  while (Date.now() < deadline) {
    if (await fn()) return
    await pause(25)
  }
  throw new Error(`Timed out: ${label}`)
}

require('../out/main/index.js')
app.whenReady().then(async () => {
  const main = BrowserWindow.getAllWindows()[0]
  main.webContents.beginFrameSubscription(() => {})
  const js = (code) => main.webContents.executeJavaScript(code)
  const press = (keyCode, modifiers = []) => {
    main.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
    if (keyCode === 'Return') main.webContents.sendInputEvent({ type: 'char', keyCode: '\r', modifiers })
    main.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
  }
  const modalOpen = () => js('Boolean(document.querySelector("dialog[open]"))')
  const clickButton = text => js(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === ${JSON.stringify(text)}).click()`)
  const editorText = () => js(`(() => {
    const content = document.querySelector('.cm-content')?.cloneNode(true)
    content?.querySelectorAll('.cm-placeholder').forEach(node => node.remove())
    return content?.textContent ?? null
  })()`)
  await until(() => js('Boolean(window.md2w && document.querySelector(".cm-content") && document.querySelector(".status-text")?.textContent !== "正在初始化…")'), 'renderer ready')
  await js('window.confirm = () => { throw new Error("Native confirm must not be used") }; window.__oldEditor = document.querySelector(".cm-editor")')
  await js('document.querySelector(".cm-content").focus()')
  await main.webContents.insertText('FILE A PRIVATE CONTENT')
  await until(async () => (await editorText()) === 'FILE A PRIVATE CONTENT', 'type A')
  await js('Array.from(document.querySelectorAll("button")).find(x => x.textContent.trim() === "文件").click()')
  await js('Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("新建文档")).click()')
  await until(modalOpen, 'new document confirmation')
  assert.equal(await js('document.activeElement.classList.contains("confirm-cancel")'), true, 'default focus must be cancel')
  press('Return')
  await until(async () => !await modalOpen(), 'Enter cancels by default')
  assert.equal(await editorText(), 'FILE A PRIVATE CONTENT')
  await clickButton('文件')
  await js('Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("新建文档")).click()')
  await until(modalOpen, 'repeat new document confirmation')
  await clickButton('仍然新建')
  await until(async () => (await editorText()) === '', 'new document')
  assert.equal(await js('window.__oldEditor !== document.querySelector(".cm-editor")'), true)
  await js('document.querySelector(".cm-content").focus()')
  await main.webContents.insertText('FILE B CONTENT')
  main.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Z', modifiers: ['control'] })
  main.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Z', modifiers: ['control'] })
  await until(async () => (await editorText()) === '', 'undo B edit')
  main.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Z', modifiers: ['control'] })
  main.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Z', modifiers: ['control'] })
  await pause(50)
  assert.equal(await editorText(), '', 'undo must never restore A into B')
  console.log('PASS document switch clears undo history; ordinary undo still works')

  // All secondary panels share top-layer focus containment and Escape behavior.
  for (const [menu, item, title] of [
    ['主题', '选择排版主题...', 'theme-modal-title'],
    ['选项', '排版输出设置...', 'settings-modal-title'],
    ['选项', '排版检查与诊断...', 'diag-modal-title'],
  ]) {
    await clickButton(menu)
    await js(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes(${JSON.stringify(item)})).click()`)
    await until(modalOpen, `${title} modal`)
    assert.equal(await js(`document.querySelector('dialog[open]').getAttribute('aria-labelledby')`), title)
    assert.equal(await js(`document.querySelector('dialog[open]').contains(document.activeElement)`), true)
    press('Escape')
    await until(async () => !await modalOpen(), `${title} Escape`)
  }
  console.log('PASS theme/settings/diagnostics share modal shell, accessible names and Escape dismissal')

  await js('window.__compile = null; window.__compileCount = 0; window.md2w.onCompileResult(e => { if (e.ok) { window.__compile = e.snapshot; window.__compileCount++ } }); true')
  const openThemes = async () => {
    await clickButton('主题')
    await js('Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("选择排版主题...")).click()')
    await until(() => js('Boolean(document.querySelector("#theme-modal-title"))'), 'theme picker')
  }
  const editThemeField = (selector, value) => js(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`)
  await openThemes()
  await js('Array.from(document.querySelectorAll(".theme-card")).find(card => card.querySelector(".theme-name").textContent === "石墨黑").querySelector(".copy-link").click()')
  await until(() => js('Boolean(document.querySelector("#theme-editor-title") && document.querySelector(".editor-controls .text-input"))'), 'custom theme editor')
  await until(() => js('Boolean(document.querySelector(".preview-container")?.shadowRoot?.querySelector(".md2w-callout"))'), 'isolated complete theme sample')
  main.webContents.debugger.attach('1.3')
  await main.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await pause(220) // Let the modal's entrance animation finish before measuring.
  await js(`window.__sample = document.querySelector('.preview-container').shadowRoot;
    window.__sampleStyle = selector => getComputedStyle(window.__sample.querySelector(selector));
    window.__sampleVisible = target => {
      const bounds = document.querySelector('.preview-viewport').getBoundingClientRect();
      const rect = window.__sample.querySelector('[data-preview-target="' + target + '"]').getBoundingClientRect();
      return rect.top >= bounds.top && rect.top < bounds.bottom - 40;
    };
    const probe = document.createElement('strong'); probe.id = 'preview-style-probe'; probe.hidden = true;
    document.querySelector('.editor-controls').append(probe);
    window.__outsideColor = getComputedStyle(probe).color;
    document.querySelector('.preview-viewport').scrollTop = 10000;
    document.querySelector('.color-grid .hex-input').focus();
    window.__leftScroll = document.querySelector('.tab-content').scrollTop;
    window.__dialogScroll = document.querySelector('dialog').scrollTop;`)
  assert.equal(await js('window.__sample.querySelectorAll("h1,h2,h3,h4,h5,h6").length >= 10'), true)
  assert.equal(await js('window.__sample.querySelectorAll("tbody tr").length'), 4)
  await editThemeField('.color-grid .hex-input', '#07c160')
  await until(() => js('window.__sampleStyle(".md2w-callout").borderLeftColor === "rgb(7, 193, 96)" && window.__sampleVisible("accent")'), 'accent updates and scrolls from bottom to its example')
  assert.equal(await js('document.activeElement === document.querySelector(".color-grid .hex-input")'), true, 'preview must preserve input focus')
  assert.equal(await js('document.querySelector(".tab-content").scrollTop === window.__leftScroll && document.querySelector("dialog").scrollTop === window.__dialogScroll'), true, 'preview scroll must not move controls or dialog')
  assert.equal(await js('window.matchMedia("(prefers-reduced-motion: reduce)").matches'), true)
  assert.equal(await js('window.__sampleStyle(".md2w-callout-title").fontWeight'), '700', 'compound selectors retain their meaning')
  const themeCapture = await main.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const themeScreenshot = path.join(dataDir, 'theme-preview-accent.png')
  await fs.writeFile(themeScreenshot, Buffer.from(themeCapture.data, 'base64'))
  console.log('THEME_SCREENSHOT ' + themeScreenshot)
  // Partial hex input must retain valid styles, then recover immediately.
  await editThemeField('.color-grid .hex-input', '#ff')
  assert.equal(await js('window.__sampleStyle(".md2w-callout").borderLeftColor'), 'rgb(7, 193, 96)')
  await editThemeField('.color-grid .hex-input', '#07c160')
  await editThemeField('.color-grid .color-item:nth-child(4) .hex-input', '#663399')
  await until(() => js('window.__sampleStyle("strong").color === "rgb(102, 51, 153)" && window.__sampleVisible("strong")'), 'strong color updates and locates')
  assert.equal(await js('getComputedStyle(document.querySelector("#preview-style-probe")).color === window.__outsideColor'), true, 'preview CSS must not leak into the editor')
  await editThemeField('.color-grid .color-item:nth-child(7) .hex-input', '#fff8ee')
  await until(() => js('window.__sampleStyle(".md2w-root").backgroundColor === "rgb(255, 248, 238)"'), 'paper color updates')
  assert.equal(await js('getComputedStyle(document.querySelector(".preview-container")).backgroundColor'), 'rgb(255, 248, 238)', 'paper margins use the selected background too')

  const selectThemeField = (selector, index) => js(`(() => {
    const select = document.querySelector(${JSON.stringify(selector)});
    select.selectedIndex = ${index}; select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await clickButton('字体与段落')
  // Use the visible field label rather than positional selectors shared by rows.
  await js(`(() => {
    const select = [...document.querySelectorAll('.tab-content label')].find(x => x.textContent.includes('首行缩进')).querySelector('select');
    select.selectedIndex = 1; select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await until(() => js('window.__sampleStyle("[data-preview-target=paragraph] .md2w-p").textIndent === "32px" && window.__sampleVisible("paragraph")'), 'indent setting is demonstrated')
  await clickButton('标题与组件')
  await selectThemeField('.tab-content select', 2)
  await until(() => js('window.__sample.querySelector(".md2w-h2").textContent.startsWith("一、") && window.__sampleVisible("headings")'), 'heading numbering is rendered and located')
  await editThemeField('.tab-content .hex-input', '#eaf4ff')
  await until(() => js('window.__sampleStyle(".md2w-pre").backgroundColor === "rgb(234, 244, 255)" && window.__sampleVisible("code")'), 'code style locates offscreen sample')
  await js(`(() => {
    const select = [...document.querySelectorAll('.tab-content label')].find(x => x.textContent.includes('表格斑马纹')).querySelector('select');
    select.selectedIndex = 0; select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await until(() => js('window.__sampleStyle(".md2w-td--zebra").backgroundColor !== "rgba(0, 0, 0, 0)" && window.__sampleVisible("table")'), 'enabling stripes works even when base theme has no stripe color')
  await until(() => js('window.__sample.querySelector("[data-preview-target=table]").dataset.active === "true"'), 'table example highlighted')
  const assertSampleGap = async (target, followingSelector) => {
    const gap = await js(`(() => {
      const sample = window.__sample.querySelector('[data-preview-target="' + ${JSON.stringify(target)} + '"]');
      const style = getComputedStyle(sample);
      const outlineBottom = sample.getBoundingClientRect().bottom + parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
      return sample.nextElementSibling.querySelector(${JSON.stringify(followingSelector)}).getBoundingClientRect().top - outlineBottom;
    })()`)
    assert.ok(gap >= 4, `${target} highlight must leave space before the next example; actual gap: ${gap}px`)
  }
  await assertSampleGap('table', '.sample-caption')
  await js(`(() => {
    const viewport = document.querySelector('.preview-viewport');
    const caption = window.__sample.querySelector('[data-preview-target=divider] .sample-caption');
    viewport.scrollTo({ top: viewport.scrollTop + caption.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientHeight / 2, behavior: 'instant' });
  })()`)
  const dividerCapture = await main.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const dividerScreenshot = path.join(dataDir, 'theme-preview-divider-spacing.png')
  await fs.writeFile(dividerScreenshot, Buffer.from(dividerCapture.data, 'base64'))
  console.log('DIVIDER_SCREENSHOT ' + dividerScreenshot)
  await js(`(() => {
    const select = [...document.querySelectorAll('.tab-content label')].find(x => x.textContent.includes('分割线形态')).querySelector('select');
    select.selectedIndex = 2; select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await until(() => js('window.__sampleStyle(".md2w-divider").borderTopStyle === "dotted"'), 'divider style is rendered')
  await until(() => js('window.__sample.querySelector("[data-preview-target=divider]").dataset.active === "true"'), 'divider example highlighted')
  await assertSampleGap('divider', '.md2w-notice')
  // A metadata edit must not jump away from the reader's current position.
  await clickButton('基础与色彩')
  await pause(200)
  await js('document.querySelector(".preview-viewport").scrollTo({ top: 800, behavior: "instant" })')
  const previewScrollBeforeRename = await js('document.querySelector(".preview-viewport").scrollTop')
  await editThemeField('input[placeholder="例如：极客青蓝"]', '预览回归测试')
  await pause(200)
  assert.equal(await js('document.querySelector(".preview-viewport").scrollTop'), previewScrollBeforeRename)
  await clickButton('恢复初始预设')
  await until(() => js('window.__sampleStyle(".md2w-callout").borderLeftColor === "rgb(17, 24, 39)"'), 'reset refreshes the isolated preview')
  await main.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] })
  main.webContents.debugger.detach()
  await js('document.querySelector("#preview-style-probe").remove(); document.querySelector(".preview-viewport").scrollTop = 10000')
  await editThemeField('.color-grid .hex-input', '#07c160')
  await until(() => js('window.__sampleVisible("accent")'), 'normal smooth scrolling also locates the sample')
  console.log('PASS theme preview: accent, complete sample, isolated CSS, invalid hex recovery, per-setting scroll, focus, numbering, indent, code, zebra, divider and reset')
  await editThemeField('input[placeholder="例如：极客青蓝"]', '')
  await clickButton('保存并设为当前主题')
  await until(() => js('Boolean(document.querySelector(".save-error[role=alert]"))'), 'save failure is visible inside editor')
  assert.equal(await js('document.querySelector(".editor-controls .text-input").value'), '', 'failed save must preserve draft')
  await editThemeField('input[placeholder="例如：极客青蓝"]', '回归自定义主题')
  await editThemeField('.color-grid .hex-input', '#07c160')
  await js('(() => { const button = document.querySelector(".editor-footer .btn-primary"); button.click(); button.click(); })()')
  await until(() => js('!document.querySelector("#theme-editor-title")'), 'save reactive draft')
  const themeFile = path.join(dataDir, 'custom-themes.json')
  let savedThemes = JSON.parse(await fs.readFile(themeFile, 'utf8'))
  assert.equal(savedThemes.length, 1, 'duplicate clicks must only save once')
  const customId = savedThemes[0].id
  assert.equal(savedThemes[0].name, '回归自定义主题')
  assert.equal(savedThemes[0].colors.accent, '#07c160')
  await until(() => js(`window.__compile?.themeId === ${JSON.stringify(customId)}`), 'custom ID accepted by compile IPC')
  await until(async () => JSON.parse(await fs.readFile(path.join(dataDir, 'settings.json'), 'utf8')).themeId === customId, 'custom ID saved as preference')

  const editSavedTheme = async () => {
    await openThemes()
    await js('Array.from(document.querySelectorAll(".theme-card")).find(card => card.querySelector(".theme-name").textContent === "回归自定义主题").querySelector("[title=编辑主题]").click()')
    await until(() => js('Boolean(document.querySelector(".editor-controls .text-input"))'), 'edit saved custom theme')
  }
  await editSavedTheme()
  const previousCompiles = await js('window.__compileCount')
  await editThemeField('.color-grid .color-item:nth-child(2) .hex-input', '#123456')
  await clickButton('保存并设为当前主题')
  await until(() => js(`window.__compileCount > ${previousCompiles} && window.__compile?.html.includes("#123456")`), 'editing active theme recompiles same ID')
  savedThemes = JSON.parse(await fs.readFile(themeFile, 'utf8'))
  assert.equal(savedThemes.length, 1)
  assert.equal(savedThemes[0].id, customId)
  assert.equal(savedThemes[0].colors.text, '#123456')
  await editSavedTheme()
  await clickButton('另存为新主题')
  await until(() => js('!document.querySelector("#theme-editor-title")'), 'save as new theme')
  savedThemes = JSON.parse(await fs.readFile(themeFile, 'utf8'))
  assert.equal(savedThemes.length, 2)
  assert.notEqual(savedThemes[0].id, savedThemes[1].id)
  assert.equal(savedThemes[1].colors.text, '#123456')
  const loadedTheme = await js(`window.md2w.getTheme(${JSON.stringify(savedThemes[1].id)})`)
  assert.equal(loadedTheme.ok && loadedTheme.data.colors.accent, '#07c160')
  console.log('PASS real theme editor: reactive draft saves, duplicate click guarded, same-ID edits recompile, save-as-new persists and reloads')

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  let imageRequests = 0
  const imageServer = http.createServer((_req, res) => { imageRequests++; res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png) })
  await new Promise(resolve => imageServer.listen(0, '127.0.0.1', resolve))
  const imageUrl = `http://127.0.0.1:${imageServer.address().port}/remote.png`
  // Generate a real short clip in the isolated test profile; no binary fixture or user files.
  const clip = await js(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d'); let tick = 0;
    const draw = () => { ctx.fillStyle = '#163f43'; ctx.fillRect(0,0,320,180); ctx.fillStyle = '#e9af64'; ctx.fillRect(15 + tick++ % 240,60,50,50); };
    draw(); const stream = canvas.captureStream(20);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }); const chunks = [];
    recorder.ondataavailable = event => { if(event.data.size) chunks.push(event.data); };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start(); const timer = setInterval(draw, 50); await new Promise(resolve => setTimeout(resolve, 1800));
    clearInterval(timer); recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
    return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(new Blob(chunks, {type:'video/webm'})); });
  })()`)
  await fs.writeFile(path.join(dataDir, 'local clip.webm'), Buffer.from(clip, 'base64'))
  const sample = `# Regression\n\nH<sub>2</sub>O 和 x<sup>2</sup>。\n\n$\\color{url(http://127.0.0.1:41397/paint.svg#x)}{x}$\n\n![本地图](local.png)\n\n![网络图](${imageUrl})\n\n![视频](<local clip.webm>)\n\n\`\`\`ts\nconst compact = 42\n\`\`\``
  await fs.writeFile(path.join(dataDir, 'local.png'), png)
  const markdownFile = path.join(dataDir, 'images.md')
  await fs.writeFile(markdownFile, sample)
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [markdownFile] })
  await js('Array.from(document.querySelectorAll("button")).find(x => x.textContent.trim() === "文件").click()')
  await js('Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("打开文件")).click()')
  await until(() => js('Boolean(window.__compile?.html.includes("<svg"))'), 'native worker conversion')
  const snapshot = await js('window.__compile')
  assert.match(snapshot.html, /<sub[^>]*>2<\/sub>/)
  assert.match(snapshot.html, /<sup[^>]*>2<\/sup>/)
  assert.equal(snapshot.html.includes('url('), false)
  assert.equal(snapshot.stats.images, 2)
  assert.equal(snapshot.stats.codeBlocks, 1)
  assert.match(snapshot.html, /<span[^>]*color:[^>]+>const\s*<\/span>/, 'bundled highlighter must still produce colored tokens')
  assert.equal(snapshot.stats.placeholders, 1)
  assert.match(snapshot.html, /src="data:image\/png;base64,/)
  assert.equal(snapshot.html.includes('TODO： local clip.webm'), true)
  assert.equal(snapshot.html.includes('<video'), false)
  assert.match(snapshot.placeholders[0].previewUrl, /^md2w-media:\/\/video\//)

  const textBeforeTitleToggle = await editorText()
  await clickButton('选项')
  await js('Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("排版输出设置...")).click()')
  await until(modalOpen, 'title option settings')
  assert.equal(await js('document.querySelector("input[aria-describedby=include-title-hint]").checked'), true)
  await js('document.querySelector("input[aria-describedby=include-title-hint]").click()')
  await until(() => js('window.__compile?.options.includeTitle === false'), 'omit title conversion')
  const bodyOnly = await js('window.__compile')
  assert.equal(bodyOnly.html.includes('Regression'), false)
  assert.equal(bodyOnly.plainText.includes('Regression'), false)
  assert.equal(bodyOnly.meta.title, 'Regression')
  assert.equal(await editorText(), textBeforeTitleToggle, 'title toggle must preserve Markdown source')
  assert.equal(bodyOnly.sourceHash, snapshot.sourceHash, 'title toggle must preserve the full source hash')
  assert.equal(JSON.parse(await fs.readFile(path.join(dataDir, 'settings.json'), 'utf8')).options.includeTitle, false)
  await pause(150)
  const titleScreenshot = path.join(dataDir, 'title-option.png')
  await fs.writeFile(titleScreenshot, (await main.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG())
  console.log(`TITLE_SCREENSHOT ${titleScreenshot}`)
  press('Escape')
  await until(async () => !await modalOpen(), 'title settings close')

  // Inspect the real clipboard payload while keeping the user's system clipboard intact.
  const clipboardOriginal = { write: clipboard.write, read: clipboard.read, readText: clipboard.readText }
  let copiedItems = []
  const copiedText = async type => {
    const payload = await copiedItems[0].getType(type)
    return typeof payload === 'string' ? payload : payload.text()
  }
  try {
    clipboard.write = async items => { copiedItems = items }
    clipboard.read = async () => copiedItems
    clipboard.readText = async () => copiedText('text/plain')
    const copied = await js('window.md2w.copySnapshot({ snapshotId: window.__compile.id, expectedRevision: window.__compile.revision })')
    assert.equal(copied.ok && copied.data.verified, true)
    assert.equal((await copiedText('text/html')).includes('Regression'), false)
    assert.equal((await copiedText('text/plain')).includes('Regression'), false)
  } finally {
    Object.assign(clipboard, clipboardOriginal)
  }
  console.log('PASS title option: native worker, saved setting and clipboard payload omit title; source and metadata preserved')

  // Inspector evaluation observes the script-disabled sandbox without granting it scripts.
  main.webContents.debugger.attach('1.3')
  let previewTarget = null, previewSession = null
  const previewJs = async expression => {
    const { targetInfos } = await main.webContents.debugger.sendCommand('Target.getTargets')
    const frame = targetInfos.find(target => target.type === 'iframe' && target.url === 'about:srcdoc')
    if (!frame) return null
    if (previewTarget !== frame.targetId) {
      const attached = await main.webContents.debugger.sendCommand('Target.attachToTarget', { targetId: frame.targetId, flatten: true })
      previewTarget = frame.targetId; previewSession = attached.sessionId
    }
    const { frameTree } = await main.webContents.debugger.sendCommand('Page.getFrameTree', {}, previewSession)
    const { executionContextId } = await main.webContents.debugger.sendCommand('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'md2w-regression' }, previewSession)
    const result = await main.webContents.debugger.sendCommand('Runtime.evaluate', { expression, contextId: executionContextId, returnByValue: true, awaitPromise: true, userGesture: true }, previewSession)
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  await until(() => previewJs('Boolean(document.querySelector("video")?.readyState >= 2)'), 'local video decodes inside sandbox preview')
  assert.equal(await previewJs('document.body.textContent.includes("Regression")'), false, 'preview body must omit title')
  assert.equal(await previewJs('document.querySelector("video").paused'), true, 'video must not autoplay')
  assert.equal(await previewJs('document.querySelector(".preview-video-notice").textContent'), '（本地视频需上传并等待审核，复制不会复制视频）')
  assert.equal(await previewJs('document.querySelector("video").controls'), true)
  await previewJs('document.querySelector("video").play(); true')
  await until(() => previewJs('document.querySelector("video").currentTime > 0.2'), 'video plays')
  await previewJs('document.querySelector("video").pause(); document.querySelector("video").currentTime = 0.8; true')
  await until(() => previewJs('!document.querySelector("video").seeking && document.querySelector("video").currentTime >= 0.8'), 'video seeks')
  await previewJs('document.querySelector("video").scrollIntoView({block:"center"}); true')
  await pause(150)
  main.webContents.invalidate()
  await pause(100)
  await fs.writeFile(path.join(dataDir, 'video-preview.png'), (await main.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG())
  console.log(`VIDEO_SCREENSHOT ${path.join(dataDir, 'video-preview.png')}`)
  console.log('PASS local video decodes, plays and seeks in sandbox; filename notice is present; autoplay disabled')
  main.webContents.debugger.detach()
  await until(() => imageRequests > 0, 'preview loads remote image through CSP')
  const exported = path.join(dataDir, 'export.html')
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: exported })
  const result = await js('window.md2w.exportHtml({ snapshotId: window.__compile.id, expectedRevision: window.__compile.revision, includeCopyButton: false })')
  assert.equal(result.ok && result.data.saved, true)
  const exportedHtml = await fs.readFile(exported, 'utf8')
  assert.equal(/<video|md2w-media:|本地视频需上传/.test(exportedHtml), false, 'export must only contain video text placeholders')
  const requests = []
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:41397/*'] }, (details, callback) => {
    requests.push(details.url)
    callback({ cancel: true })
  })
  const exportedWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, sandbox: true, contextIsolation: true } })
  await exportedWindow.loadFile(exported)
  await until(() => exportedWindow.webContents.executeJavaScript('Array.from(document.images).length === 2 && Array.from(document.images).every(image => image.complete && image.naturalWidth === 1)'), 'exported embedded and web images render')
  assert.equal(await exportedWindow.webContents.executeJavaScript('document.querySelector("#copy-content").textContent.includes("Regression")'), false, 'export body must omit title')
  await pause(600)
  assert.deepEqual(requests, [], 'export must not request an external paint URL')
  exportedWindow.close()
  console.log('PASS native worker + sub/sup + exported malicious formula makes zero external requests')
  console.log('PASS local images embed, remote images render in preview/export; only video is a placeholder')
  await new Promise(resolve => imageServer.close(resolve))

  await js('document.querySelector(".cm-content").focus()')
  main.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'End', modifiers: ['control'] })
  main.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'End', modifiers: ['control'] })
  const preCloseSuffix = '\n\nEDIT BEFORE CANCEL'
  await main.webContents.insertText(preCloseSuffix)
  main.close()
  await until(modalOpen, 'close confirmation')
  assert.equal(await js('document.querySelector("#confirm-title").textContent'), '还有修改未保存，确认关闭？')
  await pause(220)
  main.webContents.invalidate()
  await pause(100)
  const screenshot = path.join(dataDir, 'close-dialog.png')
  await fs.writeFile(screenshot, (await main.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG())
  console.log(`SCREENSHOT ${screenshot}`)
  for (let index = 0; index < 6; index++) {
    press('Tab')
    await pause(15)
    assert.equal(await js('document.querySelector("dialog[open]").contains(document.activeElement)'), true, 'Tab must remain inside modal')
  }
  press('Escape')
  await until(async () => !await modalOpen(), 'Escape cancels close')
  assert.equal(await js('document.activeElement.classList.contains("cm-content")'), true, 'cancel restores editor focus')
  assert.equal(main.isDestroyed(), false)
  await js('document.querySelector(".cm-content").focus()')
  main.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'End', modifiers: ['control'] })
  main.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'End', modifiers: ['control'] })
  const suffix = '\n\nLAST KEYSTROKE BEFORE CLOSE'
  await main.webContents.insertText(suffix)
  const closed = new Promise(resolve => main.once('closed', resolve))
  main.close() // Deliberately do not wait for the editor/worker debounce.
  await until(modalOpen, 'final close confirmation')
  await clickButton('保留副本并关闭')
  await closed
  const draftDir = path.join(dataDir, 'workcopies')
  const drafts = await Promise.all((await fs.readdir(draftDir)).filter(x => x.endsWith('.json')).map(async name => JSON.parse(await fs.readFile(path.join(draftDir, name), 'utf8'))))
  assert.equal(drafts.some(draft => draft.text === sample + preCloseSuffix + suffix), true, 'latest input must already be on disk at close')
  console.log('PASS custom confirmation: default cancel, focus containment, Escape + OS close flushes last keystroke')
  clearTimeout(timeout)
  console.log(`ELECTRON_REGRESSION PASS Electron ${process.versions.electron}, Chromium ${process.versions.chrome}`)
  app.exit(0)
}).catch(async error => {
  console.error(error)
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    console.error('UI_STATE ' + JSON.stringify(await win.webContents.executeJavaScript(`({
      editor: document.querySelector('.cm-content')?.textContent,
      html: document.querySelector('.cm-content')?.innerHTML,
      title: document.title,
      toast: document.querySelector('.toast')?.textContent,
      changed: window.__oldEditor !== document.querySelector('.cm-editor'),
      confirm: window.confirm.toString(),
      dialog: document.querySelector('dialog[open]')?.outerHTML,
      active: document.activeElement?.tagName,
      themePreview: (() => {
        const viewport = document.querySelector('.preview-viewport');
        const sample = document.querySelector('.preview-container')?.shadowRoot;
        const accent = sample?.querySelector('[data-preview-target=accent]');
        return sample && { color: getComputedStyle(sample.querySelector('.md2w-callout')).borderLeftColor,
          accent: accent.getBoundingClientRect().toJSON(), bounds: viewport.getBoundingClientRect().toJSON(),
          scrollTop: viewport.scrollTop, height: viewport.scrollHeight, css: sample.querySelector('style')?.textContent.slice(0,100),
          active: sample.querySelector('[data-active=true]')?.getAttribute('data-preview-target') };
      })(),
      videoSource: document.querySelector('.preview-frame')?.srcdoc.match(/<video[^>]+>/)?.[0]
    })`).catch(() => null)))
  }
  clearTimeout(timeout)
  app.exit(1)
})
