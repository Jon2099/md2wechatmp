import { describe, expect, it } from 'vitest'
import { buildStandaloneDocument } from '@shared/export/standalone'
import { compile } from '../helpers/compile'

describe('独立 HTML 导出', () => {
  it('注入唯一复制根节点并带复制按钮', async () => {
    const snapshot = await compile('# 标题\n\n正文一段。')
    const html = buildStandaloneDocument({
      html: snapshot.html,
      title: '标题',
      accent: '#1d4ed8',
      background: '#eef1f6',
      textColor: '#2d2d2d',
      includeCopyButton: true,
    })

    expect(html.match(/id="copy-content"/g) ?? []).toHaveLength(1)
    expect(html).toContain('id="copybtn"')
    expect(html).toContain('已复制，请到后台粘贴并审核')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain(snapshot.html.trim().slice(0, 40))
  })

  it('标题转义，避免注入', async () => {
    const snapshot = await compile('正文')
    const html = buildStandaloneDocument({
      html: snapshot.html,
      title: '<script>alert(1)</script>',
      accent: '#1d4ed8',
      background: '#eef1f6',
      textColor: '#2d2d2d',
      includeCopyButton: false,
    })
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('id="copybtn"')
  })
})
