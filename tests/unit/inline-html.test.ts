import { parseFragment } from 'parse5'
import { expect, it } from 'vitest'
import { compile } from '../helpers/compile'

function textOf(node: any): string {
  return node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(textOf).join('')
}
function elements(node: any, tag: string): any[] {
  return [...(node.tagName === tag ? [node] : []), ...(node.childNodes ?? []).flatMap((child: any) => elements(child, tag))]
}

it('化学下标和数学上标真正包住数字', async () => {
  const result = await compile('H<sub>2</sub>O 和 x<sup>2</sup>。')
  const root = parseFragment(result.html)
  expect(elements(root, 'sub').map(textOf)).toEqual(['2'])
  expect(elements(root, 'sup').map(textOf)).toEqual(['2'])
  expect(result.plainText).toBe('H2O 和 x2。')
})

it('支持嵌套和内部 Markdown，移除标签属性中的事件', async () => {
  const result = await compile('x<sup onclick="alert(1)">**2**<sub>i</sub></sup> 和 <u>下划线</u>。')
  const root = parseFragment(result.html)
  expect(elements(root, 'sup').map(textOf)).toEqual(['2i'])
  expect(elements(root, 'sub').map(textOf)).toEqual(['i'])
  expect(elements(root, 'u').map(textOf)).toEqual(['下划线'])
  expect(elements(elements(root, 'sup')[0], 'strong').map(textOf)).toEqual(['2'])
  expect(result.html).not.toContain('onclick')
})

it('未闭合或错配标签保留文字，代码不参与标签配对', async () => {
  const malformed = await compile('x<sup>2</sub>。')
  expect(malformed.plainText).toContain('x<sup>2</sub>。')
  expect(elements(parseFragment(malformed.html), 'sup')).toHaveLength(0)
  const code = await compile('`<sup>2</sup>`')
  expect(elements(parseFragment(code.html), 'sup')).toHaveLength(0)
  expect(code.plainText).toBe('`<sup>2</sup>`')
})
