import { open } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFragment, serializeOuter } from 'parse5'
import { IMAGE_DATA_PATTERN, isSafeImageSrc } from '@shared/image-policy'
import type { CompileContext } from '../pipeline/types'
import { sanitizeFragment } from '../sanitize/sanitize'
import { SVG_TAGS } from '../html/svg-policy'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024

function rasterType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return 'image/gif'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (bytes.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii', 8, 32))) return 'image/avif'
  if (bytes.toString('ascii', 0, 2) === 'BM') return 'image/bmp'
  if (bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return 'image/x-icon'
  return null
}

function embedSvg(source: string, ctx: CompileContext): string {
  const cleaned = sanitizeFragment(source, ctx.theme).html
  const fragment = parseFragment(cleaned)
  const svg = fragment.childNodes.find((node) => 'tagName' in node && node.tagName === 'svg')
  if (!svg || !('childNodes' in svg)) throw new Error('SVG 内容无效')
  const prune = (node: typeof svg): void => {
    node.childNodes = node.childNodes.filter((child) => child.nodeName === '#text' || ('tagName' in child && SVG_TAGS.has(child.tagName)))
    for (const child of node.childNodes) if ('childNodes' in child) prune(child as typeof svg)
  }
  prune(svg)
  return `data:image/svg+xml;base64,${Buffer.from(serializeOuter(svg)).toString('base64')}`
}

function embedBytes(bytes: Buffer, ctx: CompileContext): string {
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('单张图片超过 10 MB')
  ctx.counters.imageBytes += bytes.length
  if (ctx.counters.imageBytes > MAX_TOTAL_IMAGE_BYTES) throw new Error('本篇内嵌图片合计超过 30 MB')
  const mime = rasterType(bytes)
  if (mime) return `data:${mime};base64,${bytes.toString('base64')}`
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '').trim()
  if (/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) return embedSvg(text.replace(/^<\?xml[^>]*>\s*/i, ''), ctx)
  throw new Error('文件不是支持的图片格式')
}

export async function resolveImageSource(source: string, ctx: CompileContext, svgSource?: string): Promise<string> {
  ctx.checkAbort()
  if (svgSource) return embedBytes(Buffer.from(svgSource), ctx)
  const src = source.trim()
  if (!src) throw new Error('图片地址为空')
  if (/^https?:\/\//i.test(src) || src.startsWith('//')) {
    const url = new URL(src.startsWith('//') ? `https:${src}` : src).href
    if (!isSafeImageSrc(url)) throw new Error('图片地址包含不允许的协议或凭据')
    return url
  }
  if (/^data:/i.test(src)) {
    if (!IMAGE_DATA_PATTERN.test(src)) throw new Error('不支持此内嵌图片类型')
    const comma = src.indexOf(',')
    const bytes = /;base64$/i.test(src.slice(0, comma))
      ? Buffer.from(src.slice(comma + 1), 'base64')
      : Buffer.from(decodeURIComponent(src.slice(comma + 1)))
    return embedBytes(bytes, ctx)
  }
  const windowsAbsolute = /^[a-z]:[\\/]/i.test(src)
  if (!windowsAbsolute && /^[a-z][a-z\d+.-]*:/i.test(src) && !/^file:/i.test(src)) {
    throw new Error('图片地址协议不允许')
  }
  if (src.startsWith('\\\\') || /^file:\/\/[^/]/i.test(src)) throw new Error('不支持网络共享路径，请使用 HTTP 图片地址')
  if (!ctx.baseDir && !isAbsolute(src) && !windowsAbsolute && !/^file:/i.test(src)) {
    throw new Error('请先保存 Markdown 文件，以定位相对路径图片')
  }
  const path = /^file:/i.test(src) ? fileURLToPath(src) : resolve(ctx.baseDir ?? '.', decodeURIComponent(src.split(/[?#]/, 1)[0]))
  const file = await open(path, 'r')
  try {
    const info = await file.stat()
    if (!info.isFile() || info.size > MAX_IMAGE_BYTES) throw new Error('图片不是普通文件或超过 10 MB')
    // Bounded read also covers a file growing after stat().
    const bytes = Buffer.alloc(Math.min(info.size + 1, MAX_IMAGE_BYTES + 1))
    let length = 0
    while (length < bytes.length) {
      ctx.checkAbort()
      const result = await file.read(bytes, length, bytes.length - length, null)
      if (!result.bytesRead) break
      length += result.bytesRead
    }
    return embedBytes(bytes.subarray(0, length), ctx)
  } finally {
    await file.close()
  }
}
