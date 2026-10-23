const { spawn } = require('node:child_process')
const path = require('node:path')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
delete env.MD2W_DEVTOOLS
const child = spawn(require('electron'), [path.join(__dirname, 'regression-app.cjs')], {
  env, stdio: 'inherit', windowsHide: true,
})
child.on('error', (error) => { console.error(error); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
