export const VIDEO_PREVIEW_SCHEME = 'md2w-media'
export const LOCAL_VIDEO_NOTICE = '（本地视频需上传并等待审核，复制不会复制视频）'
export const REMOTE_VIDEO_NOTICE = '（视频需在公众号后台插入，复制不会复制视频）'

export function webVideoUrl(source: string): string | null {
  try {
    const url = new URL(source.startsWith('//') ? `https:${source}` : source)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch { return null }
}

export function isSafeVideoPreviewUrl(source: string): boolean {
  return /^md2w-media:\/\/video\/[a-f0-9-]{36}$/.test(source) || webVideoUrl(source) !== null
}
