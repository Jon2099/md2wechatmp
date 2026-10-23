import { describe, expect, it } from 'vitest'
import { compile } from '../helpers/compile'

describe('引用与提示块', () => {
  it('首行整段加粗的引用转为提示块 + 符号列表', async () => {
    const markdown = ['> **测算核心结论**', '> · 第一点', '> · 第二点'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('border-left:4px solid #1d4ed8')
    expect(snapshot.html).toContain('测算核心结论')
    expect(snapshot.html).toContain('<ul')
    expect(snapshot.html.match(/<li/g) ?? []).toHaveLength(2)
    expect(snapshot.diagnostics.some((item) => item.code === 'callout.converted')).toBe(true)
  })

  it('普通引用保持引用面板', async () => {
    const snapshot = await compile('> 只是一段引文')
    expect(snapshot.html).toContain('background-color:#f8fafc')
    expect(snapshot.html).not.toContain('border-left:4px solid')
  })

  it('GFM 警告标记生成警示提示块', async () => {
    const snapshot = await compile(['> [!WARNING]', '> 数据未经验证'].join('\n'))
    expect(snapshot.html).toContain('background-color:#fffbeb')
    expect(snapshot.html).toContain('数据未经验证')
  })

  it('嵌套引用扁平化并给出诊断', async () => {
    const snapshot = await compile(['> 外层', '>', '> > 内层'].join('\n'))
    expect(snapshot.html).toContain('外层')
    expect(snapshot.html).toContain('内层')
    expect(snapshot.diagnostics.some((item) => item.code === 'quote.flattened')).toBe(true)
  })

  it('单行引用中的 · 不会被误判为列表', async () => {
    const snapshot = await compile('> 只有一行 · 中间带符号')
    expect(snapshot.html).not.toContain('<ul')
  })
})
