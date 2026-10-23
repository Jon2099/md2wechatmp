/** Deterministic SVG -> PNG/ICO/ICNS. No Electron, display server or device scale. */
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { PNG } = require('pngjs')
const { Resvg, initWasm } = require('@resvg/resvg-wasm')

const ROOT = path.resolve(__dirname, '..')
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const ICNS_SLOTS = {
  icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256, ic09: 512, ic10: 1024,
  ic11: 32, ic12: 64, ic13: 256, ic14: 512,
}
let ready

function validatePng(buffer, size, label = 'PNG') {
  assert.ok(buffer.length >= 33 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), `${label}: 不是有效 PNG`)
  assert.equal(buffer.readUInt32BE(16), size, `${label}: 宽度应为 ${size}`)
  assert.equal(buffer.readUInt32BE(20), size, `${label}: 高度应为 ${size}`)
  const image = PNG.sync.read(buffer, { checkCRC: true })
  let visible = 0
  const colors = new Set()
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] < 200) continue
    visible++
    if (colors.size < 8) colors.add(`${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`)
  }
  assert.ok(visible >= size * size * .6, `${label}: 图标内容为空或大部分透明`)
  assert.ok(colors.size >= 2, `${label}: 图标只有单一颜色，缺少有效图案`)
  assert.ok(image.data[((Math.floor(size / 2) * size) + Math.floor(size / 2)) * 4 + 3] >= 200, `${label}: 中央图案缺失`)
  return image
}

async function renderIcons(svg) {
  ready ??= initWasm(fs.readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')))
  await ready
  const images = []
  for (const size of SIZES) {
    const renderer = new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } })
    let rendered
    try {
      rendered = renderer.render()
      const buffer = Buffer.from(rendered.asPng())
      validatePng(buffer, size, `${size}x${size}.png`)
      images.push({ size, buffer })
    } finally {
      rendered?.free()
      renderer.free()
    }
  }
  return images
}

function createIco(images) {
  const entries = ICO_SIZES.map(size => {
    const image = images.find(item => item.size === size)
    assert.ok(image, `ICO 缺少 ${size}px 图层`)
    validatePng(image.buffer, size, `ICO ${size}px`)
    return image
  })
  const directory = Buffer.alloc(6 + entries.length * 16)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(entries.length, 4)
  let offset = directory.length
  entries.forEach(({ size, buffer }, index) => {
    const at = 6 + index * 16
    directory[at] = size === 256 ? 0 : size
    directory[at + 1] = size === 256 ? 0 : size
    directory.writeUInt16LE(1, at + 4)
    directory.writeUInt16LE(32, at + 6)
    directory.writeUInt32LE(buffer.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += buffer.length
  })
  return Buffer.concat([directory, ...entries.map(image => image.buffer)])
}

function inspectIco(buffer) {
  assert.ok(buffer.length >= 6 && buffer.readUInt16LE(0) === 0 && buffer.readUInt16LE(2) === 1, 'ICO 文件头无效')
  assert.equal(buffer.readUInt16LE(4), ICO_SIZES.length, 'ICO 图层数错误')
  const layers = []
  let expectedOffset = 6 + ICO_SIZES.length * 16
  for (let index = 0; index < ICO_SIZES.length; index++) {
    const at = 6 + index * 16
    const size = buffer[at] || 256
    assert.equal(size, ICO_SIZES[index], 'ICO 图层尺寸错误')
    assert.equal(buffer[at + 1] || 256, size, 'ICO 图层不是正方形')
    assert.equal(buffer.readUInt16LE(at + 6), 32, 'ICO 必须是 32 位颜色')
    const length = buffer.readUInt32LE(at + 8), offset = buffer.readUInt32LE(at + 12)
    assert.equal(offset, expectedOffset, 'ICO 图层偏移错误')
    assert.ok(offset + length <= buffer.length, 'ICO 图层被截断')
    const png = buffer.subarray(offset, offset + length)
    validatePng(png, size, `ICO ${size}px`)
    layers.push({ size, buffer: png })
    expectedOffset += length
  }
  assert.equal(expectedOffset, buffer.length, 'ICO 文件长度错误')
  return layers
}

function createIcns(images) {
  const chunks = Object.entries(ICNS_SLOTS).map(([type, size]) => {
    const image = images.find(item => item.size === size)
    assert.ok(image, `ICNS 缺少 ${size}px 图层`)
    validatePng(image.buffer, size, `ICNS ${type}`)
    const header = Buffer.alloc(8)
    header.write(type, 0, 4, 'ascii')
    header.writeUInt32BE(8 + image.buffer.length, 4)
    return Buffer.concat([header, image.buffer])
  })
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4)
  return Buffer.concat([header, ...chunks])
}

function inspectIcns(buffer) {
  assert.ok(buffer.length >= 8 && buffer.toString('ascii', 0, 4) === 'icns', 'ICNS 文件头无效')
  assert.equal(buffer.readUInt32BE(4), buffer.length, 'ICNS 文件长度错误')
  const layers = new Map()
  for (let offset = 8; offset < buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4)
    const length = buffer.readUInt32BE(offset + 4)
    assert.ok(length > 8 && offset + length <= buffer.length, 'ICNS 图层被截断')
    assert.ok(ICNS_SLOTS[type] && !layers.has(type), 'ICNS 图层标识无效')
    const png = buffer.subarray(offset + 8, offset + length)
    validatePng(png, ICNS_SLOTS[type], `ICNS ${type}`)
    layers.set(type, png)
    offset += length
  }
  assert.equal(layers.size, Object.keys(ICNS_SLOTS).length, 'ICNS 缺少标准或 Retina 图层')
  return layers
}

async function buildIcons({ source = path.join(ROOT, 'build/icon.svg'), output = path.join(ROOT, 'build'), check = false } = {}) {
  const images = await renderIcons(fs.readFileSync(source, 'utf8'))
  const ico = createIco(images), icns = createIcns(images)
  inspectIco(ico)
  inspectIcns(icns)
  const files = new Map(images.map(image => [`icons/${image.size}x${image.size}.png`, image.buffer]))
  files.set('icon.png', images.find(image => image.size === 512).buffer)
  files.set('icon.ico', ico)
  files.set('icon.icns', icns)
  // Validate the complete set before overwriting any existing assets.
  if (!check) fs.mkdirSync(path.join(output, 'icons'), { recursive: true })
  for (const [name, buffer] of files) {
    const file = path.join(output, name)
    if (check) assert.ok(fs.readFileSync(file).equals(buffer), `${name}: 图标损坏或已过期，请重新生成`)
    else fs.writeFileSync(file, buffer)
  }
  return { images, ico, icns, files }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--check') || args.length > 1) {
    console.error('用法：node scripts/build-icons.cjs [--check]')
    process.exitCode = 1
  } else {
    buildIcons({ check: args.includes('--check') }).then(() => {
      console.log(`${args.includes('--check') ? '校验' : '生成并校验'}完成：9 张 PNG、7 层 ICO、11 层 ICNS（含 Retina）。`)
    }).catch(error => { console.error(`图标处理失败：${error.message}`); process.exitCode = 1 })
  }
}

module.exports = { SIZES, ICO_SIZES, ICNS_SLOTS, validatePng, renderIcons, createIco, inspectIco, createIcns, inspectIcns, buildIcons }
