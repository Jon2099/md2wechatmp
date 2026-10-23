import { clipboard, ClipboardItem } from 'electron'
import type { CopyResult } from '@shared/contracts/ipc'
import type { ContentSnapshot } from '@shared/models/snapshot'
import { ErrorCode, Md2wError } from '@shared/errors/codes'
import { snapshotStore } from './snapshot-store'

/** Windows 会把 HTML 包进 CF_HTML 头，回读时只取片段本体做比较 */
function normalizeCfHtml(raw: string): string {
  const start = raw.indexOf('<!--StartFragment-->')
  const endMarker = '<!--EndFragment-->'
  const end = raw.indexOf(endMarker)
  const fragment = start >= 0 && end > start ? raw.slice(start + '<!--StartFragment-->'.length, end) : raw
  return fragment
    .replace(/\s+>/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

async function readBackHtml(): Promise<string | null> {
  try {
    const items = await clipboard.read()
    for (const item of items) {
      if (!item.types.includes('text/html')) continue
      const payload = (await item.getType('text/html')) as unknown
      if (typeof payload === 'string') return payload
      if (payload && typeof (payload as Blob).text === 'function') {
        return await (payload as Blob).text()
      }
      return null
    }
    return null
  } catch {
    return null
  }
}

/**
 * 唯一的系统剪贴板出口：写入 HTML 与纯文本，并回读校验，
 * 校验失败仍算复制成功，但会明确告知用户去后台粘贴后人工确认。
 */
export async function copySnapshot(snapshotId: string, expectedRevision: number): Promise<CopyResult> {
  const snapshot = snapshotStore.get(snapshotId, expectedRevision) as ContentSnapshot

  try {
    await clipboard.write([
      new ClipboardItem({
        'text/plain': snapshot.plainText,
        'text/html': snapshot.html,
      }),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    throw new Md2wError(ErrorCode.ClipboardFailed, `写入剪贴板失败：${message}`)
  }

  const backText = await Promise.resolve(clipboard.readText()).catch(() => '')
  const textMatches = backText === snapshot.plainText

  const backHtml = await readBackHtml()
  const htmlMatches =
    backHtml !== null && normalizeCfHtml(backHtml) === normalizeCfHtml(snapshot.html)

  const placeholders = snapshot.stats.placeholders
  const reviewItems = snapshot.stats.reviewItems
  const images = snapshot.stats.images
  const videos = snapshot.stats.videos ?? 0
  let detail: string
  if (videos > 0 && images > 0) {
    detail = `含 ${images} 张图片、${videos} 个视频占位、${reviewItems} 个审核项`
  } else if (videos > 0) {
    detail = `含 ${videos} 个视频占位、${reviewItems} 个审核项`
  } else {
    detail = `含 ${images} 张图片、${reviewItems} 个审核项`
  }
  const verified = textMatches && htmlMatches
  return {
    verified,
    message: verified
      ? `已复制，请到微信后台粘贴并审核（${detail}）`
      : `已复制（未能回读校验，${detail}），请在粘贴后核对排版`,
    placeholders,
    reviewItems,
  }
}
