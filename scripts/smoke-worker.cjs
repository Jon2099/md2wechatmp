/**
 * 冒烟探针：在真实 Electron 运行时里验证转换进程的打包结果。
 * 用法：env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/smoke-worker.cjs
 */
const { app, utilityProcess } = require('electron')
const { join } = require('node:path')
const { readFileSync } = require('node:fs')

const root = process.cwd()
const entry = join(root, 'out', 'main', 'worker', 'compile.js')

app.disableHardwareAcceleration()

app.whenReady().then(() => {
  const started = Date.now()
  const child = utilityProcess.fork(entry, [], { serviceName: 'md2w-probe', stdio: 'pipe' })
  let ready = false

  child.stdout?.on('data', (chunk) => {
    process.stdout.write('PROBE_STDOUT ' + chunk.toString())
  })
  child.stderr?.on('data', (chunk) => {
    process.stdout.write('PROBE_STDERR ' + chunk.toString())
  })

  child.on('message', (message) => {
    if (message.type === 'ready') {
      ready = true
      const markdown = readFileSync(join(root, 'tests', 'fixtures', 'b300-backpay.md'), 'utf8')
      child.postMessage({
        type: 'compile',
        payload: {
          jobId: 'probe-1',
          docId: 'doc-probe0001',
          revision: 1,
          markdown,
          themeId: 'ocean-blue',
          options: {
            listMode: 'native',
            tableFallback: 'none',
            codeWrap: 'soft',
            firstLineIndent: false,
            highlight: true,
            mathMode: 'svg',
          },
        },
      })
      return
    }
    if (message.type === 'result') {
      const snapshot = message.snapshot
      const html = snapshot.html
      console.log(
        'PROBE_RESULT ' +
          JSON.stringify({
            status: snapshot.status,
            chars: snapshot.stats.chars,
            placeholders: snapshot.stats.placeholders,
            diagnostics: snapshot.diagnostics.length,
            htmlLength: html.length,
            hasClassAttr: /class=/.test(html),
            hasStyleTag: /<style/.test(html),
            hasDataAttr: /data-/.test(html),
            firstTag: html.slice(0, 12),
            ms: Date.now() - started,
          }),
      )
      app.exit(0)
      return
    }
    if (message.type === 'error') {
      console.log('PROBE_ERROR ' + message.code + ' ' + message.message)
      app.exit(1)
    }
  })

  child.on('exit', (code) => {
    console.log('PROBE_CHILD_EXIT code=' + code + ' ready=' + ready)
    app.exit(2)
  })

  setTimeout(() => {
    console.log('PROBE_TIMEOUT ready=' + ready)
    app.exit(3)
  }, 20000)
})
