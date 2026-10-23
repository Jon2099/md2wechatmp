import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compile } from '../helpers/compile'

const FIXTURE = resolve(__dirname, '../fixtures/b300-backpay.md')

describe('B300 案例回归（对齐微信合规版）', () => {
  it('关键结构符合合规版特征', async () => {
    const markdown = await readFile(FIXTURE, 'utf8')
    const snapshot = await compile(markdown, { themeId: 'ocean-blue' })

    expect(snapshot.status).toBe('ok')

    // 1. 根节点只有一个 section，无 div / img / script / class
    expect(snapshot.html.startsWith('<section')).toBe(true)
    expect(snapshot.html.match(/<div/g) ?? []).toHaveLength(0)
    expect(snapshot.html.match(/<img/g) ?? []).toHaveLength(0)
    expect(snapshot.html.match(/<script/g) ?? []).toHaveLength(0)
    expect(snapshot.html.match(/class=/g) ?? []).toHaveLength(0)
    expect(snapshot.html.match(/id=/g) ?? []).toHaveLength(0)
    expect(snapshot.html.match(/ on[a-z]+=/g) ?? []).toHaveLength(0)
    expect(snapshot.html).not.toContain('srcset=')
    expect(snapshot.html).not.toContain('javascript:')

    // 2. 分隔线使用 1px 高度块
    expect(snapshot.html.match(/height:1px/g)?.length ?? 0).toBeGreaterThanOrEqual(5)

    // 3. 两张表，表头背景下沉到 th
    expect(snapshot.html.match(/<table/g) ?? []).toHaveLength(2)
    const thCells = snapshot.html.match(/<th [^>]*>/g) ?? []
    expect(thCells.length).toBeGreaterThan(0)
    for (const cell of thCells) {
      expect(cell).toContain('background-color:#eef2f9')
    }

    // 4. 行内 code 不被拦腰断开
    expect(snapshot.html).toContain('word-break:normal')

    // 5. 字号只在主题档位内（1px 仅用于分割线的占位收缩）
    for (const match of snapshot.html.matchAll(/font-size:([\d.]+)px/g)) {
      expect(['21', '17', '16', '15', '14', '13', '12.5', '1']).toContain(match[1])
    }

    // 6. 引用块转成提示块
    expect(snapshot.html.match(/border-left:4px solid #1d4ed8/g)?.length ?? 0).toBeGreaterThanOrEqual(3)

    // 7. `· ` 行变成真实列表项
    expect(snapshot.html.match(/<li /g)?.length ?? 0).toBeGreaterThanOrEqual(10)

    // 8. 纯文本保留数据且无标签
    expect(snapshot.plainText).toContain('285.54')
    expect(snapshot.plainText).not.toContain('<section')
    expect(snapshot.plainText.split('TODO： ').length - 1).toBe(snapshot.stats.placeholders)

    // 美元金额不能误吞 Markdown；只有真正的回本公式生成 SVG。
    expect(snapshot.html.match(/<svg/g) ?? []).toHaveLength(1)
    expect(snapshot.html).toContain('8 卡整机基础产出（按官方 $38/小时 谷价计算）')
    expect(snapshot.html).toContain('单卡每小时产出：$38 × 7.20 = ')
    expect(snapshot.html).toContain('>回</text>')
    expect(snapshot.diagnostics.some((item) => item.code.startsWith('math.'))).toBe(false)
  })

  it('宽表给出人工审核提示', async () => {
    const markdown = await readFile(FIXTURE, 'utf8')
    const snapshot = await compile(markdown, { themeId: 'ocean-blue' })
    expect(snapshot.diagnostics.some((item) => item.code === 'table.wide')).toBe(true)
    expect(snapshot.stats.reviewItems).toBeGreaterThan(0)
  })
})
