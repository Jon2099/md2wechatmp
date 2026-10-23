const fs = require('node:fs')
const assert = require('node:assert/strict')
const { NtExecutable, NtExecutableResource } = require('resedit')

/** Inspect the actual PE manifest, rather than trusting the packaging configuration. */
function checkInstallerDpi(binary) {
  const resources = NtExecutableResource.from(NtExecutable.from(binary, { ignoreCert: true }))
  const manifests = resources.entries.filter(entry => entry.type === 24 && entry.id === 1)
  assert.ok(manifests.length > 0, 'EXE 缺少应用清单')
  for (const entry of manifests) {
    const manifest = Buffer.from(entry.bin).toString('utf8')
    const legacy = /<(?:\w+:)?dpiAware\b[^>]*>\s*([^<]+)\s*<\/(?:\w+:)?dpiAware>/i.exec(manifest)
    assert.equal(legacy?.[1].trim().toLowerCase(), 'true', '安装器未启用系统 DPI 感知')
    const modern = /<(?:\w+:)?dpiAwareness\b[^>]*>\s*([^<]+)\s*<\/(?:\w+:)?dpiAwareness>/i.exec(manifest)
    if (modern) assert.equal(modern[1].trim().toLowerCase(), 'system', 'DPI 设置覆盖了 NSIS 支持的系统缩放模式')
  }
}

if (require.main === module) {
  try {
    assert.ok(process.argv.length > 2, '用法：node scripts/check-installer-dpi.cjs <安装器.exe> [卸载器.exe]')
    for (const file of process.argv.slice(2)) {
      checkInstallerDpi(fs.readFileSync(file))
      console.log(`PASS 系统 DPI 感知：${file}`)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { checkInstallerDpi }
