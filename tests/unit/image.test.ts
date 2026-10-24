import { describe, expect, it } from 'vitest'
import { compile, placeholderTexts } from '../helpers/compile'
import { mkdir, mkdtemp, open, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const DATA_IMAGE = `data:image/png;base64,${PNG}`

describe('图片直接输出', () => {
  it('网络图片保留真实地址与替代文本，不生成占位', async () => {
    const markdown = [
      '![网络地址](https://example.com/a/chart.png?token=xxx#part)',
      '',
      '行内图片 ![结果](https://example.com/result.webp) 后面的说明。',
    ].join('\n')

    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual([])
    expect(snapshot.html).toContain('src="https://example.com/a/chart.png?token=xxx#part"')
    expect(snapshot.html).toContain('alt="网络地址"')
    expect(snapshot.html).toContain('max-width:100%')
    expect(snapshot.html).toContain('height:auto')
    expect(snapshot.html).toContain('referrerpolicy="no-referrer"')
    expect(snapshot.html).toContain('后面的说明。')
    expect(snapshot.stats.images).toBe(2)
    expect(snapshot.status).toBe('ok')
  })

  it('data URL 与内联 SVG 输出为图片，不产生内容丢失误报', async () => {
    const markdown = [`![内嵌](${DATA_IMAGE})`, '', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" /></svg>'].join('\n')
    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual([])
    expect(snapshot.html).toContain(`src="${DATA_IMAGE}"`)
    expect(snapshot.html).toContain('src="data:image/svg+xml;base64,')
    const data = /src="data:image\/svg\+xml;base64,([^\"]+)"/.exec(snapshot.html)![1]
    expect(Buffer.from(data, 'base64').toString('utf8')).toContain('<rect')
    expect(snapshot.stats.images).toBe(2)
    expect(snapshot.status).toBe('ok')
  })

  it('重复图片保留出现顺序，不合并或改成占位', async () => {
    const markdown = ['![](https://example.com/a.png)', '', '![](https://example.com/b.png)', '', '![重复](https://example.com/a.png)'].join('\n')
    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual([])
    expect(snapshot.html.match(/<img /g)).toHaveLength(3)
    expect(snapshot.html.match(/src="https:\/\/example.com\/a.png"/g)).toHaveLength(2)
  })

  it('空地址明确报错，不伪装成已转换图片', async () => {
    const snapshot = await compile(['![]()'].join('\n'))
    expect(placeholderTexts(snapshot)).toEqual([])
    expect(snapshot.status).toBe('blocked')
    expect(snapshot.diagnostics.some(item => item.code === 'image.load-failed')).toBe(true)
  })

  it('代码里的图片语法不参与替换', async () => {
    const markdown = ['`![x](a.png)`', '', '```', '![y](b.png)', '```'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.placeholders).toHaveLength(0)
    expect(snapshot.html).toContain('![x](a.png)')
    expect(snapshot.plainText).toContain('![y](b.png)')
  })

  it('图片链接保留图片，不进入文末引用', async () => {
    const markdown = '[![图](https://example.com/a.png)](https://example.com)'
    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual([])
    expect(snapshot.html).toContain('<img ')
    expect(snapshot.links).toHaveLength(0)
    expect(snapshot.html).not.toContain('[链接 1]')
  })

  it('替代文本进入 alt 与纯文本回退', async () => {
    const snapshot = await compile('![架构示意图](https://example.com/a.png)')
    expect(snapshot.html).toContain('alt="架构示意图"')
    expect(snapshot.html).not.toContain('TODO：')
    expect(snapshot.plainText).toContain('[图片：架构示意图]')
  })

  it('原始 HTML img 保留图片，丢弃事件和 srcset', async () => {
    const snapshot = await compile('<img src="https://example.com/x1.png" alt="a" onerror="alert(1)" srcset="https://example.com/other.png">')
    expect(placeholderTexts(snapshot)).toEqual([])
    expect(snapshot.html).toContain('src="https://example.com/x1.png"')
    expect(snapshot.html).not.toMatch(/onerror|srcset/)
  })

  it('相对路径、编码文件名和 file URL 都嵌入图片，不泄露本地路径', async () => {
    await mkdir(resolve('tests/.tmp'), { recursive: true })
    const dir = await mkdtemp(resolve('tests/.tmp/images-'))
    await writeFile(join(dir, '架构 图.png'), Buffer.from(PNG, 'base64'))
    const snapshot = await compile(`![相对](%E6%9E%B6%E6%9E%84%20%E5%9B%BE.png)\n\n![绝对](<${pathToFileURL(join(dir, '架构 图.png')).href}>)`, { baseDir: dir })
    expect(snapshot.status).toBe('ok')
    expect(snapshot.html.match(/src="data:image\/png;base64,/g)).toHaveLength(2)
    expect(snapshot.html).not.toContain(dir)
    expect(snapshot.html).not.toContain('file:')
    expect(snapshot.placeholders).toHaveLength(0)
  })

  it('找不到本地图片时阻止复制，保留可定位诊断', async () => {
    const snapshot = await compile('![不存在](missing.png)', { baseDir: resolve('tests/fixtures') })
    expect(snapshot.status).toBe('blocked')
    expect(snapshot.placeholders).toHaveLength(0)
    expect(snapshot.diagnostics.find(item => item.code === 'image.load-failed')?.span?.line).toBe(1)
  })

  it.each(['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'ftp://example.com/x.png'])('拒绝图片危险协议：%s', async (src) => {
    const snapshot = await compile(`![不安全](<${src}>)`)
    expect(snapshot.status).toBe('blocked')
    expect(snapshot.html).not.toContain('<img ')
    expect(snapshot.placeholders).toHaveLength(0)
  })

  it('嵌入 SVG 删除脚本、事件与外部绘制引用', async () => {
    const snapshot = await compile('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect fill="url(https://example.com/paint.svg#x)" width="1" height="1" /></svg>')
    const data = /src="data:image\/svg\+xml;base64,([^\"]+)"/.exec(snapshot.html)![1]
    const decoded = Buffer.from(data, 'base64').toString('utf8')
    expect(decoded).not.toMatch(/script|onload|url\(|https:\/\/example/)
    expect(snapshot.status).toBe('ok')
  })

  it('引用式图片和提示块标题中的图片均能显示', async () => {
    const snapshot = await compile('![引用][figure]\n\n> **标题 ![徽标](https://example.com/logo.png)**\n> 正文\n\n[figure]: https://example.com/figure.png')
    expect(snapshot.stats.images).toBe(2)
    expect(snapshot.html.match(/<img /g)).toHaveLength(2)
    expect(snapshot.placeholders).toHaveLength(0)
    expect(snapshot.status).toBe('ok')
  })

  it('picture 使用 img 后备地址，仍然只输出安全图片', async () => {
    const snapshot = await compile('<picture><source srcset="https://example.com/wide.png"><img src="https://example.com/fallback.png" alt="后备图"></picture>')
    expect(snapshot.html).toContain('src="https://example.com/fallback.png"')
    expect(snapshot.html).not.toContain('<picture')
    expect(snapshot.html).not.toContain('<source')
    expect(snapshot.stats.images).toBe(1)
    expect(snapshot.status).toBe('ok')
  })

  it('非图片本地文件不能作为图片嵌入输出', async () => {
    await mkdir(resolve('tests/.tmp'), { recursive: true })
    const dir = await mkdtemp(resolve('tests/.tmp/not-image-'))
    await writeFile(join(dir, 'secret.png'), 'PRIVATE TEXT THAT IS NOT AN IMAGE')
    const snapshot = await compile('![错误文件](secret.png)', { baseDir: dir })
    expect(snapshot.status).toBe('blocked')
    expect(snapshot.html).not.toContain(Buffer.from('PRIVATE TEXT THAT IS NOT AN IMAGE').toString('base64'))
    expect(snapshot.html).not.toContain('<img ')
  })

  it('超出单图大小限制时在读取前阻断，只有视频才生成占位', async () => {
    await mkdir(resolve('tests/.tmp'), { recursive: true })
    const dir = await mkdtemp(resolve('tests/.tmp/large-image-'))
    const file = await open(join(dir, 'large.png'), 'w')
    await file.truncate(10 * 1024 * 1024 + 1)
    await file.close()
    const snapshot = await compile('![大图](large.png)\n\n![视频](demo.mp4)', { baseDir: dir })
    expect(snapshot.status).toBe('blocked')
    expect(snapshot.diagnostics.some(item => item.message.includes('10 MB'))).toBe(true)
    expect(placeholderTexts(snapshot)).toEqual(['TODO： demo.mp4'])
  })
})

describe('视频占位', () => {
  it('普通 Markdown 视频链接在原位置生成占位，不进入文末链接', async () => {
    const files = ['video_01_godot_adventure.mp4', 'video_02_turbofan.mp4', 'video_03_nvda_model.mp4']
    const snapshot = await compile(files.map((file, index) => `片段 ${index + 1}：[观看视频](assets/${file})。`).join('\n\n'), { themeId: 'graphite' })
    expect(snapshot.status).toBe('ok')
    expect(placeholderTexts(snapshot)).toEqual(files.map(file => `TODO： ${file}`))
    expect(snapshot.placeholders.map(record => record.source)).toEqual(files.map(file => `assets/${file}`))
    expect(snapshot.links).toEqual([])
    expect(snapshot.stats.videos).toBe(3)
    expect(snapshot.stats.images).toBe(0)
    expect(snapshot.plainText).toContain('片段 1：TODO： video_01_godot_adventure.mp4。')
    expect(snapshot.html).not.toContain('[链接 ')
    expect(snapshot.html).not.toContain('assets/')
    expect(snapshot.html).not.toMatch(/<video|<a /)
  })

  it('参考式、自动链接与带参数的视频链接均生成占位，普通链接从 1 编号', async () => {
    const snapshot = await compile([
      '[本地视频][clip]',
      '<https://example.com/demo.MP4?token=123#t=4>',
      'https://example.com/movie.webm',
      '[片段](assets/%E6%BC%94%E7%A4%BA%20%E7%89%87.mov)',
      '[文档](https://example.com/docs)',
      '',
      '[clip]: assets/intro.mp4',
    ].join('\n\n'))
    expect(snapshot.status).toBe('ok')
    expect(placeholderTexts(snapshot)).toEqual(['TODO： intro.mp4', 'TODO： demo.MP4', 'TODO： movie.webm', 'TODO： 演示 片.mov'])
    expect(snapshot.links.map(link => [link.index, link.url])).toEqual([[1, 'https://example.com/docs']])
  })

  it('代码中的视频链接不转换，危险协议仍按链接拦截', async () => {
    const snapshot = await compile('`[视频](assets/demo.mp4)`\n\n```md\n[视频](assets/movie.mp4)\n```\n\n[不安全](javascript:evil.mp4)')
    expect(snapshot.placeholders).toEqual([])
    expect(snapshot.links).toEqual([])
    expect(snapshot.plainText).toContain('[视频](assets/demo.mp4)')
    expect(snapshot.plainText).toContain('[视频](assets/movie.mp4)')
    expect(snapshot.diagnostics.some(item => item.code === 'link.blocked-protocol')).toBe(true)
  })

  it('重复视频逐次占位，图片和视频外层的跳转链接不生成重复占位', async () => {
    const snapshot = await compile([
      '[片段](demo.mp4)',
      '[再次观看](demo.mp4)',
      '[![封面](https://example.com/cover.png)](demo.mp4)',
      '[![内层视频](inner.webm)](outer.mp4)',
    ].join('\n\n'))
    expect(snapshot.status).toBe('ok')
    expect(placeholderTexts(snapshot)).toEqual(['TODO： demo.mp4', 'TODO： demo.mp4', 'TODO： inner.webm'])
    expect(snapshot.stats.images).toBe(1)
    expect(snapshot.links).toEqual([])
    expect(snapshot.html).toContain('src="https://example.com/cover.png"')
    expect(snapshot.html).not.toContain('outer.mp4')
  })

  it('Markdown 语法中的视频文件转为视频占位', async () => {
    const markdown = [
      '![演示视频](videos/demo.mp4)',
      '',
      '![宣传片](https://example.com/assets/promo.mov?token=123)',
      '',
      '![教程动画](figures/guide.webm)',
    ].join('\n')

    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual([
      'TODO： demo.mp4',
      'TODO： promo.mov',
      'TODO： guide.webm',
    ])
    expect(snapshot.placeholders[0].mediaType).toBe('video')
    expect(snapshot.diagnostics.some((d) => d.code === 'video.placeholder')).toBe(true)
    expect(snapshot.stats.videos).toBe(3)
    expect(snapshot.stats.images).toBe(0)
    expect(snapshot.stats.placeholders).toBe(3)
  })

  it('HTML video 标签支持 src 与 source 子标签', async () => {
    const markdown = [
      '<video src="intro.mp4" controls></video>',
      '',
      '<video controls>',
      '  <source src="feature.mp4" type="video/mp4">',
      '</video>',
    ].join('\n')

    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual(['TODO： intro.mp4', 'TODO： feature.mp4'])
    expect(snapshot.html).not.toContain('<video')
    expect(snapshot.html).not.toContain('src=')
    expect(snapshot.html).toContain('TODO： intro.mp4')
    expect(snapshot.html).toContain('TODO： feature.mp4')
  })

  it('无文件名视频与 data URL 视频按顺序生成编号占位', async () => {
    const markdown = [
      '<video></video>',
      '',
      '<video src="data:video/mp4;base64,AAAA"></video>',
      '',
      '![视频]()',
    ].join('\n')

    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual([
      'TODO： 未命名视频-001',
      'TODO： 内嵌视频-001',
      'TODO： 未命名视频-002',
    ])
    expect(snapshot.diagnostics.some((d) => d.code === 'video.unnamed')).toBe(true)
  })

  it('B站与腾讯视频 iframe 转为识别度高的视频占位', async () => {
    const markdown = [
      '<iframe src="https://player.bilibili.com/player.html?bvid=BV1AB4y1v7cD"></iframe>',
      '',
      '<iframe src="https://v.qq.com/txp/iframe/player.html?vid=m0034xxxx"></iframe>',
    ].join('\n')

    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual([
      'TODO： bilibili-BV1AB4y1v7cD',
      'TODO： video-m0034xxxx',
    ])
    expect(snapshot.html).not.toContain('<iframe')
  })

  it('图文混排时图片直接输出，仅视频计入占位数量', async () => {
    const markdown = [
      '![示意图](https://example.com/diagram.png)',
      '',
      '<video src="demo.mp4"></video>',
    ].join('\n')

    const snapshot = await compile(markdown)
    expect(placeholderTexts(snapshot)).toEqual(['TODO： demo.mp4'])
    expect(snapshot.stats.images).toBe(1)
    expect(snapshot.stats.videos).toBe(1)
    expect(snapshot.stats.placeholders).toBe(1)
  })
})
