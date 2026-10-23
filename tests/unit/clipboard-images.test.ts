import { expect, it, vi } from 'vitest'
import { compile } from '../helpers/compile'
import { snapshotStore } from '../../src/main/services/snapshot-store'

const h = vi.hoisted(() => ({ items: [] as Array<{ data: Record<string, string>; types: string[]; getType: (name: string) => Promise<string> }> }))
vi.mock('electron', () => ({
  ClipboardItem: class {
    data: Record<string, string>
    constructor(data: Record<string, string>) { this.data = data }
    get types() { return Object.keys(this.data) }
    async getType(name: string) { return this.data[name] }
  },
  clipboard: {
    write: async (items: typeof h.items) => { h.items = items },
    read: async () => h.items,
    readText: () => h.items[0].data['text/plain'],
  },
}))

it('剪贴板 HTML 保留图片，提示与占位数只将视频计为占位', async () => {
  const snapshot = await compile('![图示](https://example.com/photo.png)\n\n![视频](demo.mp4)')
  snapshot.placeholders[0].previewUrl = 'md2w-media://video/11111111-1111-1111-1111-111111111111'
  snapshotStore.put(snapshot)
  const { copySnapshot } = await import('../../src/main/services/clipboard-service')
  const result = await copySnapshot(snapshot.id, snapshot.revision)
  expect(result.verified).toBe(true)
  expect(result.placeholders).toBe(1)
  expect(result.message).toContain('1 张图片、1 个视频占位')
  expect(result.message).not.toContain('图片占位')
  expect(h.items[0].data['text/html']).toContain('src="https://example.com/photo.png"')
  expect(h.items[0].data['text/html']).toContain('TODO： demo.mp4')
  expect(h.items[0].data['text/plain']).toContain('[图片：图示]')
  expect(h.items[0].types).toEqual(['text/plain', 'text/html'])
  expect(h.items[0].data['text/html']).not.toMatch(/<video|md2w-media:|本地视频需上传/)
  expect(h.items[0].data['text/plain']).not.toContain('md2w-media:')
  snapshotStore.clear()
})
