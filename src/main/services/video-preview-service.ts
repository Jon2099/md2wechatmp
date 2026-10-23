import { randomUUID } from 'node:crypto'
import { open, realpath } from 'node:fs/promises'
import { extname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import type { ContentSnapshot, PlaceholderRecord } from '@shared/models/snapshot'
import { VIDEO_PREVIEW_SCHEME, webVideoUrl } from '@shared/video-policy'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
  '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
}

function validHeader(bytes: Buffer, extension: string): boolean {
  if (['.mp4', '.m4v', '.mov'].includes(extension)) return bytes.toString('ascii', 4, 8) === 'ftyp'
  if (['.webm', '.mkv'].includes(extension)) return bytes.subarray(0, 4).toString('hex') === '1a45dfa3'
  if (extension === '.avi') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'AVI '
  return false
}

function localPath(source: string, baseDir?: string): string {
  if (!source || /[\u0000-\u001f\u007f]/.test(source)) throw new Error('视频地址为空或包含无效字符。')
  if (/^[\\/]{2}/.test(source)) throw new Error('不支持网络共享路径，请使用本地视频文件。')
  if (/^file:/i.test(source)) {
    const url = new URL(source)
    if (url.hostname && url.hostname !== 'localhost') throw new Error('不支持网络共享路径。')
    const file = fileURLToPath(url)
    if (/^[\\/]{2}/.test(file)) throw new Error('不支持网络共享路径。')
    return file
  }
  const windowsAbsolute = /^[a-z]:[\\/]/i.test(source)
  if (/^[a-z][a-z\d+.-]*:/i.test(source) && !windowsAbsolute) throw new Error('此视频地址不支持直接预览。')
  const decoded = decodeURIComponent(source.split(/[?#]/, 1)[0])
  if (/^[\\/]{2}/.test(decoded)) throw new Error('不支持网络共享路径。')
  if (!baseDir && !isAbsolute(decoded) && !windowsAbsolute) throw new Error('请先保存 Markdown，以确定本地视频路径。')
  return resolve(baseDir ?? '.', decoded)
}

/** Only opaque URLs registered from a compiled document can read local video bytes. */
export class VideoPreviewService {
  private files = new Map<string, { path: string; mime: string; extension: string }>()
  private batches: string[][] = []

  async prepare(snapshot: ContentSnapshot, baseDir?: string): Promise<ContentSnapshot> {
    const tokens: string[] = []
    const placeholders: PlaceholderRecord[] = []
    for (const original of snapshot.placeholders) {
      const record = { ...original }
      delete record.previewUrl
      delete record.previewError
      if (record.mediaType !== 'video') { placeholders.push(record); continue }
      const source = record.source ?? ''
      const remote = webVideoUrl(source)
      if (record.kind === 'iframe') record.previewError = '此视频为平台嵌入链接，请在原平台预览。'
      else if (remote) record.previewUrl = remote
      else {
        try {
          const filePath = await realpath(localPath(source, baseDir))
          if (/^[\\/]{2}/.test(filePath)) throw new Error('不支持网络共享路径。')
          const extension = extname(filePath).toLowerCase()
          const mime = MIME[extension]
          if (!mime) throw new Error('此格式暂不支持本地预览，请使用 MP4 或 WebM。')
          const file = await open(filePath, 'r')
          try {
            if (!(await file.stat()).isFile()) throw new Error('视频路径不是文件。')
            const bytes = Buffer.alloc(32)
            await file.read(bytes, 0, bytes.length, 0)
            if (!validHeader(bytes, extension)) throw new Error('视频内容与文件格式不符，无法预览。')
          } finally { await file.close() }
          const token = randomUUID()
          this.files.set(token, { path: filePath, mime, extension })
          tokens.push(token)
          record.previewUrl = `${VIDEO_PREVIEW_SCHEME}://video/${token}`
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code
          record.previewError = code === 'ENOENT' ? '找不到本地视频，请检查文件路径。'
            : code === 'EACCES' || code === 'EPERM' ? '无法读取本地视频，请检查文件权限。'
            : error instanceof URIError ? '视频路径编码无效，请检查文件名。'
            : error instanceof Error && !code ? error.message : '本地视频无法读取，请检查文件路径或格式。'
        }
      }
      placeholders.push(record)
    }
    this.batches.push(tokens)
    while (this.batches.length > 8) for (const token of this.batches.shift()!) this.files.delete(token)
    return { ...snapshot, placeholders }
  }

  async respond(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.protocol !== `${VIDEO_PREVIEW_SCHEME}:` || url.hostname !== 'video' || url.search || url.hash) return new Response(null, { status: 404 })
    const entry = this.files.get(url.pathname.slice(1))
    if (!entry) return new Response(null, { status: 404 })
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
    try {
      const file = await open(entry.path, 'r')
      let handedOff = false
      try {
        const stat = await file.stat()
        const bytes = Buffer.alloc(32)
        await file.read(bytes, 0, bytes.length, 0)
        if (!stat.isFile() || !validHeader(bytes, entry.extension)) return new Response(null, { status: 404 })
        const headers = new Headers({
          'Content-Type': entry.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*',
        })
        let start = 0, end = stat.size - 1
        const range = request.headers.get('range')
        if (range) {
          const matched = /^bytes=(\d*)-(\d*)$/.exec(range)
          if (!matched || (!matched[1] && !matched[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } })
          start = matched[1] ? Number(matched[1]) : Math.max(0, stat.size - Number(matched[2]))
          end = matched[1] && matched[2] ? Math.min(Number(matched[2]), end) : end
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } })
          headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`)
        }
        headers.set('Content-Length', String(end - start + 1))
        if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers })
        // The validated handle also owns the bounded stream; no whole-file buffering.
        const stream = file.createReadStream({ start, end, autoClose: true })
        const response = new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers })
        handedOff = true
        return response
      } finally { if (!handedOff) await file.close().catch(() => {}) }
    } catch { return new Response(null, { status: 404 }) }
  }

  clear(): void { this.files.clear(); this.batches = [] }
}
