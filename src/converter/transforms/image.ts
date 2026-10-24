import type { ImageKind, MediaType } from '@shared/models/snapshot'
import type { CompileContext, MdNode } from '../pipeline/types'
import type { DiagnosticSink } from '../pipeline/types'
import { childrenOf, sliceSource, textOf, transform } from '../pipeline/ast'
import { DEFAULT_LIMITS } from '../pipeline/types'
import { analyzeRawHtml, coalesceMediaHtml, type RawInline } from '../parse/raw-html'
import { resolveImageSource } from './image-source'

const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g

export const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'webm',
  'avi',
  'mkv',
  'flv',
  'm4v',
  '3gp',
  'wmv',
  'rmvb',
  'ts',
])

export function isVideoUrl(src: string, alt = ''): boolean {
  if (/^data:video\//i.test(src)) return true
  const withoutHash = src.split('#')[0].split('?')[0].trim()
  const dot = withoutHash.lastIndexOf('.')
  if (dot > 0) {
    const ext = withoutHash.slice(dot + 1).toLowerCase()
    if (VIDEO_EXTENSIONS.has(ext)) return true
  }
  if (!src && /视频|video/i.test(alt)) return true
  return false
}

function isVideoLink(node: MdNode): boolean {
  if (node.type !== 'link') return false
  const src = String(node.url ?? '').trim()
  // Keep unsafe/unsupported protocols in the normal link validation path.
  if (/^[a-z][a-z\d+.-]*:/i.test(src) && !/^(?:https?:|file:|[a-z]:[\\/])/i.test(src)) return false
  const hasMedia = (child: MdNode): boolean => child.type === 'wxImage'
    || child.type === 'image' || child.data?.wxVideoPlaceholder === true
    || childrenOf(child).some(hasMedia)
  return isVideoUrl(src) && !childrenOf(node).some(hasMedia)
}

export function placeholderText(fileName: string): string {
  return `TODO： ${fileName}`
}

interface BaseName {
  fileName: string | null
  kind: ImageKind
  mediaType: MediaType
}

function safeDecode(value: string): { value: string; failed: boolean } {
  if (!value.includes('%')) return { value, failed: false }
  try {
    return { value: decodeURIComponent(value), failed: false }
  } catch {
    return { value, failed: true }
  }
}

export function baseNameOf(
  src: string | null | undefined,
  hint: ImageKind = 'file',
  mediaTypeHint: MediaType = 'image',
): BaseName {
  const raw = (src ?? '').trim()
  let mediaType = mediaTypeHint

  if (!raw) {
    return { fileName: null, kind: hint === 'file' ? 'unnamed' : hint, mediaType }
  }

  if (/^data:/i.test(raw)) {
    if (/^data:video\//i.test(raw)) mediaType = 'video'
    return { fileName: null, kind: 'data', mediaType }
  }

  if (hint === 'iframe' || mediaType === 'video') {
    try {
      const urlObj = new URL(raw, 'https://dummy.local')
      const bvid = urlObj.searchParams.get('bvid')
      if (bvid) return { fileName: `bilibili-${bvid}`, kind: 'iframe', mediaType: 'video' }
      const vid = urlObj.searchParams.get('vid')
      if (vid) return { fileName: `video-${vid}`, kind: 'iframe', mediaType: 'video' }
      if (urlObj.hostname.includes('bilibili.com')) {
        return { fileName: 'bilibili视频', kind: 'iframe', mediaType: 'video' }
      }
      if (urlObj.hostname.includes('v.qq.com')) {
        return { fileName: '腾讯视频', kind: 'iframe', mediaType: 'video' }
      }
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        return { fileName: 'YouTube视频', kind: 'iframe', mediaType: 'video' }
      }
    } catch {
      // ignore
    }
  }

  const withoutHash = raw.split('#')[0].split('?')[0]
  const decoded = safeDecode(withoutHash)
  const unified = decoded.value.replace(/\\/g, '/')
  const segments = unified.split('/')
  let last = segments[segments.length - 1] ?? ''
  last = last.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim()

  const dot = last.lastIndexOf('.')
  if (dot > 0) {
    const ext = last.slice(dot + 1).toLowerCase()
    if (VIDEO_EXTENSIONS.has(ext)) {
      mediaType = 'video'
    }
  }

  if (!last || last === '.' || last === '..') {
    return { fileName: null, kind: hint === 'file' ? 'unnamed' : hint, mediaType }
  }
  return { fileName: last, kind: hint, mediaType }
}

function prefixOf(kind: ImageKind, mediaType: MediaType): string {
  if (mediaType === 'video') {
    if (kind === 'data') return '内嵌视频'
    if (kind === 'iframe') return '嵌入视频'
    return '未命名视频'
  }
  if (kind === 'data') return '内嵌图片'
  if (kind === 'svg') return '内联图片'
  return '未命名图片'
}

function formatUnnamed(kind: ImageKind, mediaType: MediaType, index: number, total: number): string {
  const width = Math.max(3, String(Math.max(total, 1)).length)
  return `${prefixOf(kind, mediaType)}-${String(index).padStart(width, '0')}`
}

function counterKey(kind: ImageKind, mediaType: MediaType): string {
  const prefix = mediaType === 'video' ? 'video_' : 'image_'
  if (kind === 'data') return `${prefix}data`
  if (kind === 'svg') return `${prefix}svg`
  if (kind === 'iframe') return `${prefix}iframe`
  return `${prefix}unnamed`
}

function resolvePlaceholder(
  base: BaseName,
  ctx: CompileContext,
  sink: DiagnosticSink,
  span: ReturnType<CompileContext['spanOf']>,
): string {
  if (base.fileName) return placeholderText(base.fileName)
  const key = counterKey(base.kind, base.mediaType)
  ctx.counters.unnamedByKind[key] = (ctx.counters.unnamedByKind[key] ?? 0) + 1
  const index = ctx.counters.unnamedByKind[key]
  const total = ctx.counters.unnamedTotalByKind[key] ?? 0
  const name = formatUnnamed(base.kind, base.mediaType, index, total)
  const label = base.mediaType === 'video' ? '视频' : '图片'
  sink.push({
    code: `${base.mediaType}.unnamed`,
    severity: 'warning',
    message: `未能识别出${label}的文件名，已按序号生成清晰占位。`,
    action: `生成占位标识：${placeholderText(name)}。`,
    advice: `粘贴至微信后台后，请使用公众号编辑器的「插入${label}」功能替换该占位。`,
    review: true,
    span,
  })
  return placeholderText(name)
}

function countUnnamed(root: MdNode): Record<string, number> {
  const totals: Record<string, number> = {}
  const consider = (src: string | null, hint: ImageKind, mediaType: MediaType) => {
    const base = baseNameOf(src, hint, mediaType)
    if (base.mediaType === 'video' && !base.fileName) {
      const key = counterKey(base.kind, base.mediaType)
      totals[key] = (totals[key] ?? 0) + 1
    }
  }
  transform(root, (node) => {
    if (node.type === 'image' || isVideoLink(node)) {
      const src = String(node.url ?? '')
      const alt = String(node.alt ?? '')
      const isVideo = isVideoUrl(src, alt)
      consider(src, 'file', isVideo ? 'video' : 'image')
    }
    if (node.type === 'html') {
      for (const item of analyzeRawHtml(String(node.value ?? '')).inline) {
        if (item.kind !== 'image') continue
        const hint: ImageKind = item.imageKind === 'svg' ? 'svg' : item.imageKind === 'iframe' ? 'iframe' : 'file'
        consider(item.src, hint, item.mediaType)
      }
    }
    return node
  })
  return totals
}

export async function transformMedia(root: MdNode, ctx: CompileContext): Promise<void> {
  coalesceMediaHtml(root, ctx.source)
  ctx.counters.unnamedTotalByKind = countUnnamed(root)
  const images: MdNode[] = []
  const countedSources = new Set<MdNode>()
  const imageNode = (src: string, alt: string, original: MdNode, svgSource?: string): MdNode => {
    if (!countedSources.has(original)) {
      ctx.counters.imageSourceChars += sliceSource(ctx.source, original).length
      countedSources.add(original)
    }
    const node: MdNode = { type: 'wxImage', url: src, alt, svgSource, position: original.position }
    images.push(node)
    return node
  }
  const rawParts = (items: RawInline[], original: MdNode): MdNode[] => items.flatMap((item): MdNode[] => {
    if (item.kind === 'text') return item.value ? [{ type: 'text', value: item.value }] : []
    if (item.kind === 'br') return [{ type: 'break' }]
    if (item.kind === 'wrap') return [{ type: 'wxRawInline', tag: item.tag, children: rawParts(item.children, original) }]
    if (item.mediaType !== 'video' && !isVideoUrl(item.src ?? '', item.alt ?? '')) {
      return [imageNode(item.src ?? '', item.alt ?? '', original, item.svgSource)]
    }
    const hint: ImageKind = item.imageKind === 'iframe' ? 'iframe' : 'file'
    const base = baseNameOf(item.src, hint, 'video')
    const value = resolvePlaceholder(base, ctx, ctx.diagnostics, ctx.spanOf(original))
    record(ctx, value, base, original, item.src ?? '')
    return [{ type: 'text', value, data: { wxVideoPlaceholder: true } }]
  })
  const hasRawMedia = (items: RawInline[]): boolean => items.some(item => item.kind === 'image' || (item.kind === 'wrap' && hasRawMedia(item.children)))

  const visit = (node: MdNode): MdNode | MdNode[] => {
    if (node.wxTitle) {
      const titleRoot = transform({ type: 'root', children: node.wxTitle }, visit)
      node.wxTitle = childrenOf(titleRoot ?? undefined)
    }
    if (node.type === 'image' || isVideoLink(node)) {
      const src = String(node.url ?? '')
      const alt = String(node.alt ?? '')
      const isVideo = isVideoUrl(src, alt)
      if (!isVideo) return imageNode(src, alt, node)
      const base = baseNameOf(src, 'file', isVideo ? 'video' : 'image')
      if (src.includes('%')) {
        const decoded = safeDecode(src)
        if (decoded.failed) {
          const label = base.mediaType === 'video' ? '视频' : '图片'
          ctx.diagnostics.push({
            code: `${base.mediaType}.decode-failed`,
            severity: 'info',
            message: `${label}文件名含有特殊编码字符，已按安全名称处理。`,
            action: '保留原始文件名生成占位，不影响排版。',
            review: false,
            span: ctx.spanOf(node),
          })
        }
      }
      const text = resolvePlaceholder(base, ctx, ctx.diagnostics, ctx.spanOf(node))
      record(ctx, text, base, node, src)
      return { type: 'text', value: text, position: node.position, data: { wxVideoPlaceholder: true } }
    }

    if (node.type === 'html') {
      const analysis = analyzeRawHtml(String(node.value ?? ''))
      if (analysis.blocked.length > 0) {
        ctx.diagnostics.push({
          code: 'html.unsupported-tag',
          severity: 'warning',
          message: `原始 HTML 标签未启用：${Array.from(new Set(analysis.blocked)).join('、')}`,
          action: '整段按纯文本转义输出',
          advice: '改写成 Markdown 语法，或直接在微信后台处理',
          review: true,
          span: ctx.spanOf(node),
        })
        return { type: 'text', value: String(node.value ?? '') }
      }
      const hasImage = hasRawMedia(analysis.inline)
      if (!hasImage) return node

      return rawParts(analysis.inline, node)
    }

    return node
  }
  const replaced = transform(root, visit)
  if (replaced) root.children = childrenOf(replaced)
  for (const [index, node] of images.entries()) {
    ctx.checkAbort()
    try {
      if (index >= DEFAULT_LIMITS.maxImages) throw new Error('图片数量超过 500 张')
      node.url = await resolveImageSource(String(node.url ?? ''), ctx, node.svgSource as string | undefined)
      ctx.counters.images += 1
    } catch (error) {
      ctx.checkAbort()
      ctx.diagnostics.push({
        code: 'image.load-failed', severity: 'error',
        message: `图片无法载入：${error instanceof Error ? error.message : '读取失败'}`,
        action: '请修正图片地址或文件后重新转换。', review: true, span: ctx.spanOf(node),
      })
      node.type = 'text'
      node.value = `[图片无法载入：${node.alt || '未命名图片'}]`
    }
  }
}

function record(
  ctx: CompileContext,
  text: string,
  base: BaseName,
  node: MdNode,
  source: string,
): void {
  const fileName = base.fileName ?? text.replace(/^TODO： /, '')
  ctx.placeholders.push({
    index: ctx.placeholders.length + 1,
    text,
    fileName,
    kind: base.kind,
    mediaType: base.mediaType,
    span: ctx.spanOf(node),
    source,
  })
  const label = base.mediaType === 'video' ? '视频' : '图片'
  ctx.diagnostics.push({
    code: `${base.mediaType}.placeholder`,
    severity: 'info',
    message: `微信后台不支持直接粘贴外部${label}，已生成占位符：${text}。`,
    action: `粘贴至微信后，请点击编辑器的「插入${label}」替换该占位。`,
    review: false,
    span: ctx.spanOf(node),
  })
}

export function imageTextOf(node: MdNode): string {
  return textOf(node)
}
