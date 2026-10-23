import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5'
import type { PlaceholderRecord } from '@shared/models/snapshot'
import { isSafeVideoPreviewUrl, LOCAL_VIDEO_NOTICE, REMOTE_VIDEO_NOTICE, webVideoUrl } from '@shared/video-policy'

type Parent = DefaultTreeAdapterMap['parentNode']
type Child = DefaultTreeAdapterMap['childNode']

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function noticeCaption(record: PlaceholderRecord): string {
  const notice = webVideoUrl(record.source ?? '') || record.kind === 'iframe' ? REMOTE_VIDEO_NOTICE : LOCAL_VIDEO_NOTICE
  return `<span class="preview-video-notice">${notice}</span>`
}

function playerWidget(record: PlaceholderRecord): string {
  if (!record.previewUrl || !isSafeVideoPreviewUrl(record.previewUrl)) {
    return `<span class="preview-video-unavailable">${escape(record.previewError || '视频暂时无法预览，请检查文件路径或格式。')}</span>`
  }
  return `<span class="preview-video-player"><video controls playsinline preload="metadata" src="${escape(record.previewUrl)}" aria-label="预览视频：${escape(record.fileName)}">当前环境无法播放此视频。</video></span>`
}

/** Add players only to the preview document; snapshot HTML/plainText stay untouched. */
export function addVideoPreviews(html: string, records: PlaceholderRecord[]): string {
  const pending = records.filter(record => record.mediaType === 'video' && record.text)
  if (!pending.length) return html
  const fragment = parseFragment(html)
  function visit(parent: Parent): void {
    const output: Child[] = []
    for (const node of parent.childNodes) {
      if (node.nodeName === '#text' && 'value' in node) {
        let remaining = node.value
        let changed = false
        let rendered = ''
        while (pending.length) {
          const candidates = pending.map((record, index) => ({ record, index, at: remaining.indexOf(record.text) }))
            .filter(item => item.at >= 0).sort((a, b) => a.at - b.at || b.record.text.length - a.record.text.length)
          const match = candidates[0]
          if (!match) break
          const textBlock = `<span class="preview-video-placeholder">${escape(match.record.text)}${noticeCaption(match.record)}</span>`
          rendered += escape(remaining.slice(0, match.at)) +
            `<span class="preview-video-block">${textBlock}${playerWidget(match.record)}</span>`
          remaining = remaining.slice(match.at + match.record.text.length)
          pending.splice(match.index, 1)
          changed = true
        }
        if (changed) {
          const content = parseFragment(rendered + escape(remaining))
          for (const child of content.childNodes) { child.parentNode = parent; output.push(child) }
        } else output.push(node)
      } else {
        if ('tagName' in node && !['pre', 'code', 'svg', 'math'].includes(node.tagName)) visit(node)
        output.push(node)
      }
    }
    parent.childNodes = output
  }
  visit(fragment)
  return serialize(fragment)
}
