const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { config } = require('../package.json')

// Electron 42+ no longer downloads its runtime during npm install.
const root = path.resolve(__dirname, '..')
const installer = path.join(root, 'node_modules', 'electron', 'install.js')

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === '1') {
  console.log('Skipping Electron binary download (ELECTRON_SKIP_BINARY_DOWNLOAD=1).')
} else if (!fs.existsSync(installer)) {
  if (process.argv.includes('--if-present')) {
    console.log('Electron devDependency is absent; skipping binary download.')
  } else {
    console.error('Electron package is missing. Run npm install --include=dev first.')
    process.exitCode = 1
  }
} else {
  const mirror = process.env.ELECTRON_MIRROR
    || process.env.npm_config_electron_mirror
    || config.electron_mirror
  const result = spawnSync(process.execPath, [installer], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_MIRROR: mirror,
      npm_config_electron_mirror: mirror,
      npm_package_config_electron_mirror: mirror
    }
  })
  if (result.error) console.error(result.error.message)
  process.exitCode = result.status ?? 1
}
