const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { NtExecutable, NtExecutableResource } = require('resedit')
const { checkInstallerDpi } = require('../../scripts/check-installer-dpi.cjs')

function executable(manifest) {
  const exe = NtExecutable.createEmpty(true, false)
  const resources = NtExecutableResource.from(exe)
  if (manifest) resources.entries.push({ type: 24, id: 1, lang: 1033, codepage: 65001, bin: Buffer.from(manifest) })
  resources.outputResource(exe)
  return Buffer.from(exe.generate())
}

test('真实 PE 资源校验会拒绝旧版缺少 DPI 声明的安装器', () => {
  assert.throws(() => checkInstallerDpi(executable()), /缺少应用清单/)
  assert.throws(() => checkInstallerDpi(executable('<assembly/>')), /未启用系统 DPI/)
  assert.throws(() => checkInstallerDpi(executable('<dpiAware>false</dpiAware>')), /未启用系统 DPI/)
})

test('系统 DPI 声明通过校验；显式覆盖为 unaware 或 PerMonitorV2 时拒绝', () => {
  checkInstallerDpi(executable('<dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true</dpiAware>'))
  checkInstallerDpi(executable('<a:dpiAware>true</a:dpiAware><b:dpiAwareness>System</b:dpiAwareness>'))
  for (const mode of ['Unaware', 'PerMonitorV2']) {
    assert.throws(() => checkInstallerDpi(executable(`<dpiAware>true</dpiAware><dpiAwareness>${mode}</dpiAwareness>`)), /覆盖/)
  }
})

// A real NSIS compile also catches invalid hooks and checks the generated uninstaller.
// Supply MAKENSIS_PATH on CI; locally use the same cached compiler as build.py.
const root = path.resolve(__dirname, '../..')
const cache = path.join(root, 'tests/.tmp/packaging-cache/nsis-3.0.4.1')
const compiler = process.env.MAKENSIS_PATH || (process.platform === 'win32' && fs.existsSync(cache)
  ? fs.readdirSync(cache).map(name => path.join(cache, name, 'makensis.exe')).find(file => fs.existsSync(file)) : undefined)
const findCached = (folder, suffix) => {
  const base = path.join(root, 'tests/.tmp/packaging-cache', folder)
  return fs.existsSync(base) ? fs.readdirSync(base).map(name => path.join(base, name, ...suffix)).find(file => fs.existsSync(file)) : undefined
}
const sevenZip = process.env.MAKENSIS_7ZIP_PATH || findCached('7zip@1.0.0', ['bin', '7za.exe'])
const plugin = process.env.NSIS_PLUGIN_DIR || findCached('nsis-resources-3.4.1', ['plugins', 'x86-unicode'])
test('NSIS 自定义头在实际编译的安装器和卸载器中都启用 DPI 感知', { skip: !compiler || process.platform !== 'win32' ? '需要 Windows 与 NSIS 编译器' : false }, () => {
  const scratch = path.join(root, 'tests/.tmp')
  fs.mkdirSync(scratch, { recursive: true })
  const output = fs.mkdtempSync(path.join(scratch, 'installer-dpi-'))
  const installer = path.join(output, 'setup.exe'), uninstaller = path.join(output, 'uninstall.exe')
  const script = path.join(output, 'fixture.nsi')
  fs.writeFileSync(script, [
    'Unicode true', 'Name "DPI regression"', `OutFile "${installer}"`,
    'RequestExecutionLevel user', 'SilentInstall silent',
    `!include "${path.join(root, 'build/installer.nsh')}"`, '!insertmacro customHeader',
    'Function .onInit', `WriteUninstaller "${uninstaller}"`, 'SetErrorLevel 0', 'Quit', 'FunctionEnd',
    'Section', 'SectionEnd', 'Section Uninstall', 'SectionEnd',
  ].join('\r\n'))
  const compile = spawnSync(compiler, ['/V2', script], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
  assert.equal(compile.status, 0, compile.error?.message || compile.stdout + compile.stderr)
  checkInstallerDpi(fs.readFileSync(installer))
  const generate = spawnSync(installer, [], { windowsHide: true, timeout: 10000 })
  assert.equal(generate.status, 0, generate.error?.message)
  checkInstallerDpi(fs.readFileSync(uninstaller))
})

test('LZMA 安装器可加载 Nsis7z 插件并无损解压内嵌的应用文件', { skip: process.platform !== 'win32' || !compiler || !sevenZip || !plugin ? '需要 Windows、NSIS 和 7-Zip 工具链' : false }, () => {
  const output = fs.mkdtempSync(path.join(root, 'tests/.tmp/installer-extract-'))
  const source = path.join(output, 'source'), decoded = path.join(output, 'decoded')
  fs.mkdirSync(source)
  const files = { '正文.txt': Buffer.from('标题开关、公式、高亮与视频均需完整保留。'), 'media.bin': require('node:crypto').randomBytes(65536) }
  for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(source, name), data)
  const archive = path.join(output, 'app.7z')
  const compress = spawnSync(sevenZip, ['a', '-t7z', '-mx=9', archive, '.'], { cwd: source, windowsHide: true, encoding: 'utf8', timeout: 30000 })
  assert.equal(compress.status, 0, compress.error?.message || compress.stdout + compress.stderr)
  const installer = path.join(output, 'setup.exe'), script = path.join(output, 'fixture.nsi')
  fs.writeFileSync(script, [
    'Unicode true', 'Name "Compression regression"', `OutFile "${installer}"`,
    'RequestExecutionLevel user', 'SilentInstall silent',
    `!addplugindir /x86-unicode "${plugin}"`,
    `!include "${path.join(root, 'build/installer.nsh')}"`, '!insertmacro customHeader',
    'Section', 'InitPluginsDir', 'SetCompress off',
    `File /oname=$PLUGINSDIR\\app.7z "${archive}"`, 'SetCompress auto',
    `SetOutPath "${decoded}"`, 'Nsis7z::Extract "$PLUGINSDIR\\app.7z"', 'SetErrorLevel 0', 'SectionEnd',
  ].join('\r\n'))
  const compiled = spawnSync(compiler, ['/V2', script], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
  assert.equal(compiled.status, 0, compiled.error?.message || compiled.stdout + compiled.stderr)
  const extracted = spawnSync(installer, [], { windowsHide: true, timeout: 15000 })
  assert.equal(extracted.status, 0, extracted.error?.message)
  for (const [name, data] of Object.entries(files)) assert.deepEqual(fs.readFileSync(path.join(decoded, name)), data)
})
