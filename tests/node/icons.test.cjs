const { test, before } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')
const { SIZES, ICO_SIZES, ICNS_SLOTS, validatePng, renderIcons, createIco, inspectIco, createIcns, inspectIcns, buildIcons } = require('../../scripts/build-icons.cjs')

const root = path.resolve(__dirname, '../..')
const source = path.join(root, 'build/icon.svg')
const scratch = path.join(root, 'tests/.tmp')
const svg = fs.readFileSync(source, 'utf8')
let images
before(async () => { images = await renderIcons(svg); fs.mkdirSync(scratch, { recursive: true }) })

test('每个标称尺寸都是真实像素尺寸，且有可见的绿色底和文档图案', () => {
  assert.deepEqual(images.map(image => image.size), SIZES)
  for (const { size, buffer } of images) {
    const decoded = validatePng(buffer, size)
    assert.equal(decoded.width, size)
    assert.equal(decoded.height, size)
    let green = 0, paper = 0
    for (let i = 0; i < decoded.data.length; i += 4) {
      const [r, g, b, a] = decoded.data.subarray(i, i + 4)
      if (a > 200 && g > r + 30 && g > b + 20) green++
      // 小尺寸的纸张与绿色线条会抗锯齿混色，检查明亮纸面而非仅统计纯白像素。
      if (a > 200 && r > 180 && g > 200 && b > 180) paper++
    }
    assert.ok(green > size * size * .4, `${size}px 缺少绿色背景`)
    assert.ok(paper > size * size * .15, `${size}px 缺少文档图案`)
  }
})

test('ICO 每一层的目录尺寸、PNG 尺寸及源图完全一致', () => {
  const layers = inspectIco(createIco(images))
  assert.deepEqual(layers.map(layer => layer.size), ICO_SIZES)
  for (const layer of layers) assert.deepEqual(layer.buffer, images.find(image => image.size === layer.size).buffer)
})

test('ICNS 标准与 Retina 图层齐全，每层图像尺寸和内容正确', () => {
  const layers = inspectIcns(createIcns(images))
  assert.deepEqual([...layers.keys()], Object.keys(ICNS_SLOTS))
  for (const [type, buffer] of layers) assert.deepEqual(buffer, images.find(image => image.size === ICNS_SLOTS[type]).buffer)
})

test('透明空图、纯色空图和 DPI 导致的尺寸错误会被拒绝', () => {
  const empty = new PNG({ width: 32, height: 32 })
  assert.throws(() => validatePng(PNG.sync.write(empty), 32), /为空|透明/)
  empty.data.fill(255)
  assert.throws(() => validatePng(PNG.sync.write(empty), 32), /单一颜色/)
  assert.throws(() => validatePng(images.find(image => image.size === 48).buffer, 32), /宽度应为 32/)
})

test('损坏的 PNG、ICO 偏移、ICNS 长度和缺失图层不能通过校验', () => {
  const png = Buffer.from(images[0].buffer)
  png[40] ^= 255
  assert.throws(() => validatePng(png, 16))
  const ico = createIco(images)
  ico.writeUInt32LE(1, 18)
  assert.throws(() => inspectIco(ico), /偏移错误/)
  const icns = createIcns(images)
  icns.writeUInt32BE(icns.length - 1, 4)
  assert.throws(() => inspectIcns(icns), /长度错误/)
  assert.throws(() => createIco(images.filter(image => image.size !== 32)), /缺少 32/)
  assert.throws(() => createIcns(images.filter(image => image.size !== 1024)), /缺少 1024/)
})

test('生成文件能被重新读回校验；手工损坏后检查会失败', async () => {
  const output = fs.mkdtempSync(path.join(scratch, 'icons-'))
  await buildIcons({ source, output })
  await buildIcons({ source, output, check: true })
  assert.deepEqual(fs.readFileSync(path.join(output, 'icon.png')), images.find(image => image.size === 512).buffer)
  fs.writeFileSync(path.join(output, 'icons/64x64.png'), 'INVALID PNG')
  await assert.rejects(buildIcons({ source, output, check: true }), /图标损坏或已过期/)
})

test('源图损坏或为空时不覆盖已有图标', async () => {
  const output = fs.mkdtempSync(path.join(scratch, 'invalid-icons-'))
  const invalidSource = path.join(output, 'blank.svg')
  fs.writeFileSync(path.join(output, 'icon.ico'), 'KEEP EXISTING ICON')
  fs.writeFileSync(invalidSource, '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>')
  await assert.rejects(buildIcons({ source: invalidSource, output }), /为空|透明/)
  assert.equal(fs.readFileSync(path.join(output, 'icon.ico'), 'utf8'), 'KEEP EXISTING ICON')
  assert.equal(fs.existsSync(path.join(output, 'icons')), false)
})

test('仓库中用于三平台打包的图标与 SVG 源文件一致', async () => {
  await buildIcons({ check: true })
})
