import { describe, expect, it } from 'vitest'
import { compile } from '../helpers/compile'

describe('链接与文末引用', () => {
  it('外部链接转文末引用且跟随编号', async () => {
    const markdown = '先看 [官方文档](https://example.com/doc)，再看 [文档](https://example.com/doc)。'
    const snapshot = await compile(markdown)
    expect(snapshot.links).toHaveLength(1)
    expect(snapshot.html).toContain('[链接 1]')
    expect(snapshot.html).toContain('参考链接')
    expect(snapshot.html).toContain('https://example.com/doc')
    expect(snapshot.diagnostics.some((item) => item.code === 'link.deduped')).toBe(true)
  })

  it('不同查询串不合并', async () => {
    const markdown = '[a](https://e.com/x?u=1) 和 [b](https://e.com/x?u=2)'
    const snapshot = await compile(markdown)
    expect(snapshot.links).toHaveLength(2)
    expect(snapshot.html).toContain('[链接 1]')
    expect(snapshot.html).toContain('[链接 2]')
  })

  it('危险协议只保留文字并给出警告', async () => {
    const snapshot = await compile('[点我](javascript:alert(1))')
    expect(snapshot.links).toHaveLength(0)
    expect(snapshot.html).not.toContain('javascript:')
    expect(snapshot.html).toContain('点我')
    expect(snapshot.diagnostics.some((item) => item.code === 'link.blocked-protocol')).toBe(true)
  })

  it('参考式链接正常解析', async () => {
    const markdown = ['见 [说明][ref]。', '', '[ref]: https://example.com/a'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.links).toHaveLength(1)
    expect(snapshot.html).toContain('[链接 1]')
  })

  it('缺失定义的参考式链接保留文字并警告', async () => {
    const snapshot = await compile('见 [说明][missing]。')
    expect(snapshot.links).toHaveLength(0)
    expect(snapshot.html).toContain('说明')
    expect(snapshot.diagnostics.some((item) => item.code === 'markdown.unresolved-reference')).toBe(true)
  })
})

describe('脚注', () => {
  it('脚注独立编号并集中到文末', async () => {
    const markdown = ['正文[^1]。', '', '[^1]: 第一条注释'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.footnotes).toHaveLength(1)
    expect(snapshot.html).toContain('[注 1]')
    expect(snapshot.html).toContain('注释')
  })
})
