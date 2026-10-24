import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { VideoPreviewService } from '../../src/main/services/video-preview-service'
import { buildPreviewDocument } from '../../src/renderer/features/preview/preview-document'
import { LOCAL_VIDEO_NOTICE } from '@shared/video-policy'
import type { ContentSnapshot, PlaceholderRecord } from '@shared/models/snapshot'
import { compile } from '../helpers/compile'
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5'

let folder: string
let service: VideoPreviewService
let snapshot: ContentSnapshot
const bytes = Buffer.concat([Buffer.from('1a45dfa3', 'hex'), Buffer.alloc(508, 7)])
beforeEach(async () => {
  await mkdir(resolve('tests/.tmp'), { recursive: true })
  folder = await mkdtemp(resolve('tests/.tmp/video-'))
  await writeFile(join(folder, '预览 片.webm'), bytes)
  service = new VideoPreviewService()
  snapshot = await compile('![视频](%E9%A2%84%E8%A7%88%20%E7%89%87.webm)')
})
afterEach(() => service.clear())

describe('本地视频预览与流式读取', () => {
  it('普通视频链接复用本地预览服务，导出仍只保留视频占位', async () => {
    const linked = await compile('[观看视频](%E9%A2%84%E8%A7%88%20%E7%89%87.webm)')
    const result = await service.prepare(linked, folder)
    expect(result.status).toBe('ok')
    expect(result.placeholders).toHaveLength(1)
    expect(result.placeholders[0].previewUrl).toMatch(/^md2w-media:\/\/video\/[a-f0-9-]{36}$/)
    expect(result.html).toContain('TODO： 预览 片.webm')
    expect(result.html).not.toMatch(/<video|md2w-media|\[链接 /)
    expect(Buffer.from(await (await service.respond(new Request(result.placeholders[0].previewUrl!))).arrayBuffer())).toEqual(bytes)
    const html = buildPreviewDocument({ html: result.html, placeholders: result.placeholders, title: '预览', accent: '#1d4ed8', width: 375 })
    expect(html).toContain('<video controls=')
    expect(html).toContain(LOCAL_VIDEO_NOTICE)
  })

  it('相对路径与 file URL 生成不含本地路径的预览地址，不改写复制和导出内容', async () => {
    const result = await service.prepare(snapshot, folder)
    const record = result.placeholders[0]
    expect(record.previewUrl).toMatch(/^md2w-media:\/\/video\/[a-f0-9-]{36}$/)
    expect(record.previewUrl).not.toContain(folder)
    expect(record.source).toBe('%E9%A2%84%E8%A7%88%20%E7%89%87.webm')
    expect(result.html).toBe(snapshot.html)
    expect(result.plainText).toBe(snapshot.plainText)
    expect(result.html).not.toMatch(/<video|md2w-media|file:/)
    const absolute = await compile(`![视频](<${pathToFileURL(join(folder, '预览 片.webm')).href}>)`)
    expect((await service.prepare(absolute)).placeholders[0].previewUrl).toBeTruthy()
  })

  it('支持 GET、HEAD、Range 和后缀范围，拖动播放时只读取所需字节', async () => {
    const result = await service.prepare(snapshot, folder)
    const url = result.placeholders[0].previewUrl!
    const full = await service.respond(new Request(url))
    expect(full.status).toBe(200)
    expect(full.headers.get('content-type')).toBe('video/webm')
    expect(Buffer.from(await full.arrayBuffer())).toEqual(bytes)
    const partial = await service.respond(new Request(url, { headers: { Range: 'bytes=4-15' } }))
    expect(partial.status).toBe(206)
    expect(partial.headers.get('content-range')).toBe('bytes 4-15/512')
    expect(partial.headers.get('content-length')).toBe('12')
    expect(Buffer.from(await partial.arrayBuffer())).toEqual(bytes.subarray(4, 16))
    const tail = await service.respond(new Request(url, { headers: { Range: 'bytes=-8' } }))
    expect(Buffer.from(await tail.arrayBuffer())).toEqual(bytes.subarray(-8))
    const head = await service.respond(new Request(url, { method: 'HEAD' }))
    expect(head.headers.get('content-length')).toBe('512')
    expect(await head.text()).toBe('')
    for (const range of ['bytes=900-', 'bytes=-0', 'bytes=12-2', 'bytes=0-1,4-5', 'bytes=-', 'bytes=999999999999999999999-']) {
      expect((await service.respond(new Request(url, { headers: { Range: range } }))).status).toBe(416)
    }
    expect((await service.respond(new Request(url, { method: 'POST' }))).status).toBe(405)
  })

  it('未知地址、已撤销地址及被替换为文本的文件不能读取', async () => {
    expect((await service.respond(new Request('md2w-media://video/private.txt'))).status).toBe(404)
    const result = await service.prepare(snapshot, folder)
    const url = result.placeholders[0].previewUrl!
    expect((await service.respond(new Request(url + '?path=C:/secret.txt'))).status).toBe(404)
    await writeFile(join(folder, '预览 片.webm'), 'PRIVATE TEXT')
    expect((await service.respond(new Request(url))).status).toBe(404)
    await writeFile(join(folder, '预览 片.webm'), bytes)
    service.clear()
    expect((await service.respond(new Request(url))).status).toBe(404)
  })

  it('只保留最近八批预览，旧地址失效', async () => {
    const first = (await service.prepare(snapshot, folder)).placeholders[0].previewUrl!
    for (let i = 0; i < 8; i++) await service.prepare(snapshot, folder)
    expect((await service.respond(new Request(first))).status).toBe(404)
  })

  it('未保存文档、缺失视频和伪装文件只影响预览，不阻止复制占位', async () => {
    expect((await service.prepare(snapshot)).placeholders[0].previewError).toContain('请先保存')
    const missing = await service.prepare(await compile('![视频](missing.webm)'), folder)
    expect(missing.placeholders[0].previewError).toContain('找不到本地视频')
    await writeFile(join(folder, 'bad.mp4'), 'THIS IS NOT A VIDEO')
    const invalid = await service.prepare(await compile('![视频](bad.mp4)'), folder)
    expect(invalid.status).toBe('ok')
    expect(invalid.placeholders[0].previewError).toContain('格式不符')
    expect(invalid.placeholders[0].previewUrl).toBeUndefined()
  })

  it('网络直链可预览；嵌入平台和危险协议不会变成播放器地址', async () => {
    const remote = await service.prepare(await compile('![视频](https://example.com/demo.mp4?token=1)'))
    expect(remote.placeholders[0].previewUrl).toBe('https://example.com/demo.mp4?token=1')
    const embed = await service.prepare(await compile('<iframe src="https://player.bilibili.com/player.html?bvid=BV1AB4y1v7cD"></iframe>'))
    expect(embed.placeholders[0].previewUrl).toBeUndefined()
    expect(embed.placeholders[0].previewError).toContain('原平台')
    for (const source of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'https://user:pass@example.com/a.mp4', '\\\\host\\share\\a.mp4', 'file://host/share/a.mp4', '%5C%5Chost/share/a.mp4']) {
      const unsafe = { ...snapshot, placeholders: [{ ...snapshot.placeholders[0], source }] }
      const record = (await service.prepare(unsafe, folder)).placeholders[0]
      expect(record.previewUrl).toBeUndefined()
      expect(record.previewError).toBeTruthy()
    }
  })
})

describe('仅供桌面预览的视频播放器', () => {
  const record = (extra: Partial<PlaceholderRecord> = {}): PlaceholderRecord => ({
    index: 1, text: 'TODO： demo.webm', fileName: 'demo.webm', kind: 'file', mediaType: 'video',
    source: 'demo.webm', previewUrl: 'md2w-media://video/11111111-1111-1111-1111-111111111111', ...extra,
  })
  const preview = (html: string, placeholders: PlaceholderRecord[]) => buildPreviewDocument({ html, placeholders, title: '预览', accent: '#1d4ed8', width: 375 })

  it('文件名后带提示，下方带原生播放控件，禁止自动播放', () => {
    const html = preview('<section>TODO： demo.webm</section>', [record()])
    expect(html).toContain(`TODO： demo.webm<span class="preview-video-notice">${LOCAL_VIDEO_NOTICE}</span>`)
    expect(html).toContain('<video controls="" playsinline="" preload="metadata"')
    expect(html).not.toContain('autoplay')
    expect(html.indexOf('<video')).toBeGreaterThan(html.indexOf('TODO： demo.webm'))
  })

  it('代码和属性中的 TODO 不替换；重复文件名各自对应不同地址', () => {
    const html = preview('<section title="TODO： demo.webm"><code>TODO： demo.webm</code>TODO： demo.webm<br>TODO： demo.webm</section>', [
      record(), record({ index: 2, previewUrl: 'https://example.com/second.mp4?a=1&b=2' }),
    ])
    expect(html.match(/<video /g)).toHaveLength(2)
    expect(html).toContain('<code>TODO： demo.webm</code>')
    expect(html).toContain('title="TODO： demo.webm"')
    expect(html).toContain('https://example.com/second.mp4?a=1&amp;b=2')
  })

  it('文件名、错误说明和来源不能注入 HTML 或事件', () => {
    const html = preview('<section>TODO： demo.webm</section>', [record({ fileName: '"><script>bad()</script>', previewError: '<img src=x onerror=bad()>', previewUrl: 'javascript:bad()' })])
    expect(html).not.toContain('<video')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img src=x onerror=bad()&gt;')
    const fileName = preview('<section>TODO： demo.webm</section>', [record({ fileName: '"><script>bad()</script>' })])
    const elements: DefaultTreeAdapterMap['element'][] = []
    function visit(node: DefaultTreeAdapterMap['node']): void {
      if ('tagName' in node) elements.push(node)
      if ('childNodes' in node) node.childNodes.forEach(visit)
    }
    visit(parseFragment(fileName))
    expect(elements.some(element => element.tagName === 'script')).toBe(false)
    expect(elements.find(element => element.tagName === 'video')?.attrs.find(attr => attr.name === 'aria-label')?.value)
      .toBe('预览视频："><script>bad()</script>')
  })
})
