const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const asar = require('@electron/asar')

const appDir = path.resolve(process.env.PACKAGED_APP_DIR || 'dist/slim-final/win-unpacked')
const archive = path.join(appDir, 'resources/app.asar')
const exists = fs.existsSync(archive)
const skip = exists ? false : '请先生成 Windows 目录包，或设置 PACKAGED_APP_DIR'

test('发布包保留三个必要语言，不包含其他 Chromium 界面语言', { skip }, () => {
  const locales = fs.readdirSync(path.join(appDir, 'locales')).filter(name => name.endsWith('.pak')).sort()
  assert.deepEqual(locales, ['en-US.pak', 'zh-CN.pak', 'zh-TW.pak'])
})

test('打包内容不含调试映射；主进程、预加载、前端资源及独立转换进程齐全', { skip }, () => {
  const files = asar.listPackage(archive).map(name => name.replace(/\\/g, '/').replace(/^\//, ''))
  assert.ok(!files.some(name => name.endsWith('.map')), 'app.asar 不应包含 source map')
  for (const file of ['out/main/index.js', 'out/preload/index.js', 'out/renderer/index.html', 'out/main/worker/compile.js']) {
    assert.ok(files.includes(file), `缺少 ${file}`)
    const localPath = path.join(...file.split('/'))
    const content = asar.extractFile(archive, localPath)
    assert.ok(content.length > 0)
    assert.deepEqual(content, fs.readFileSync(localPath), `${file} 必须与已经运行回归的构建产物一致`)
    assert.doesNotMatch(content.toString('utf8'), /^\s*\/\/[#@]\s*sourceMappingURL=/m, `${file} 不应引用调试映射`)
  }
  const scan = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name)
    return entry.isDirectory() ? scan(name) : [name]
  })
  assert.ok(!scan(appDir).some(name => name.endsWith('.map')), '独立转换进程也不应包含 source map')
  assert.ok(fs.statSync(path.join(appDir, 'resources/app.asar.unpacked/out/main/worker/compile.js')).size > 0)
})

test('仅打包应用运行目录，调试截图、导出样稿和开发示例不进入安装包', { skip }, () => {
  const files = asar.listPackage(archive).map(name => name.replace(/\\/g, '/').replace(/^\//, ''))
  const allowed = /^(?:package\.json$|out(?:$|\/(?:main|preload|renderer)(?:\/|$)))/
  assert.deepEqual(files.filter(name => !allowed.test(name)), [])
})

test('保留视频解码、国际字符、沙箱与图形回退运行库，窗口图标正确', { skip }, () => {
  for (const name of ['排版助手.exe', 'ffmpeg.dll', 'icudtl.dat', 'resources.pak', 'chrome_100_percent.pak', 'chrome_200_percent.pak', 'dxcompiler.dll', 'd3dcompiler_47.dll', 'vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll', 'snapshot_blob.bin', 'v8_context_snapshot.bin', 'LICENSE.electron.txt', 'LICENSES.chromium.html']) {
    assert.ok(fs.statSync(path.join(appDir, name)).size > 0, `缺少运行库 ${name}`)
  }
  assert.deepEqual(fs.readFileSync(path.join(appDir, 'resources/icon.png')), fs.readFileSync('build/icon.png'))
})
