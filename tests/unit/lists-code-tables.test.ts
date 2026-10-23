import { describe, expect, it } from 'vitest'
import { compile } from '../helpers/compile'

describe('列表与任务列表', () => {
  it('无序与有序列表输出原生结构', async () => {
    const markdown = ['- 一', '- 二', '', '1. 甲', '2. 乙'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('list-style-type:disc')
    expect(snapshot.html).toContain('list-style-type:decimal')
    expect(snapshot.plainText).toContain('- 一')
    expect(snapshot.plainText).toContain('1. 甲')
  })

  it('非 1 起始编号使用可见序号', async () => {
    const markdown = ['3. 第三', '4. 第四'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('list-style-type:none')
    expect(snapshot.plainText).toContain('3. 第三')
    expect(snapshot.plainText).toContain('4. 第四')
  })

  it('任务列表静态化为 ☑/☐', async () => {
    const markdown = ['- [x] 已完成', '- [ ] 待办'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('☑')
    expect(snapshot.html).toContain('☐')
    expect(snapshot.html).not.toContain('<input')
  })

  it('静态序号开关把无序列表改为可见符号', async () => {
    const snapshot = await compile(['- 一', '- 二'].join('\n'), { options: { listMode: 'static' } })
    expect(snapshot.html).toContain('list-style-type:none')
    expect(snapshot.plainText).toContain('- 一')
  })
})

describe('代码块', () => {
  it('保留空白与换行并输出围栏纯文本', async () => {
    const markdown = ['```js', 'const a = 1;', '', '  console.log(a);', '```'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('const a = 1;')
    expect(snapshot.html).toContain('white-space:pre-wrap')
    expect(snapshot.plainText).toBe('```\nconst a = 1;\n\n  console.log(a);\n```')
    expect(snapshot.stats.codeBlocks).toBe(1)
  })

  it('mermaid 保留源码并提示人工处理', async () => {
    const markdown = ['```mermaid', 'graph TD;', 'A-->B;', '```'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('graph TD;')
    expect(snapshot.diagnostics.some((item) => item.code === 'diagram.source-block')).toBe(true)
  })

  it('公式默认转换为矢量 SVG 且无警告', async () => {
    const markdown = ['$$', 'E = mc^2', '$$'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('<svg')
    expect(snapshot.html).toContain('path')
    expect(snapshot.plainText).toContain('E = mc^2')
    expect(snapshot.diagnostics.length).toBe(0)
  })

  it('行内公式转换为矢量 SVG', async () => {
    const markdown = '质能方程为 $E = mc^2$，这是基本物理定律。'
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('<svg')
    expect(snapshot.plainText).toContain('$E = mc^2$')
    expect(snapshot.diagnostics.length).toBe(0)
  })

  it('公式可配置为 raw 模式保留原始定界符', async () => {
    const markdown = ['$$', 'E = mc^2', '$$'].join('\n')
    const snapshot = await compile(markdown, { options: { mathMode: 'raw' } })
    expect(snapshot.html).toContain('$$')
    expect(snapshot.html).toContain('E = mc^2')
    expect(snapshot.diagnostics.some((item) => item.code === 'math.block-review')).toBe(true)
  })
})

describe('表格', () => {
  it('对齐下沉到单元格', async () => {
    const markdown = ['| A | B |', '| :--- | ---: |', '| 1 | 2 |'].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('text-align:right')
    expect(snapshot.html).toContain('<th')
    expect(snapshot.html).toContain('background-color:#eef2f9')
  })

  it('宽表收紧急字号并提示审核', async () => {
    const markdown = [
      '| A | B | C | D | E |',
      '| --- | --- | --- | --- | --- |',
      '| 1 | 2 | 3 | 4 | 5 |',
    ].join('\n')
    const snapshot = await compile(markdown)
    expect(snapshot.html).toContain('font-size:12.5px')
    expect(snapshot.diagnostics.some((item) => item.code === 'table.wide')).toBe(true)
  })

  it('宽表可转为文字条目', async () => {
    const markdown = [
      '| 指标 | 数值 | 说明 | 单位 | 来源 |',
      '| --- | --- | --- | --- | --- |',
      '| 吞吐 | 155 | 日吞吐 | 万亿 | 官方 |',
    ].join('\n')
    const snapshot = await compile(markdown, { options: { tableFallback: 'records' } })
    expect(snapshot.html).not.toContain('<table')
    expect(snapshot.plainText).toContain('指标：吞吐')
    expect(snapshot.diagnostics.some((item) => item.code === 'table.fallback-records')).toBe(true)
  })
})
