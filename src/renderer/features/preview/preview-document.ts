import type { PlaceholderRecord } from '@shared/models/snapshot'
import { addVideoPreviews } from './preview-video'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface PreviewDocumentOptions {
  html: string
  title: string
  accent: string
  width: number
  placeholders?: PlaceholderRecord[]
}

/**
 * Keep article layout intact; video players are inserted here only for desktop preview.
 */
export function buildPreviewDocument(options: PreviewDocumentOptions): string {
  const width = Math.max(280, Math.min(480, Math.trunc(options.width)))
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.title)}</title>
<style>
  html, body { margin: 0; padding: 0; background-color: #eef1f6; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    color: #1f2937;
    -webkit-font-smoothing: antialiased;
  }
  #preview-phone {
    width: ${width}px;
    max-width: 100%;
    margin: 0 auto;
    padding: 14px 14px 40px;
    box-sizing: border-box;
    background-color: #ffffff;
    min-height: 100vh;
  }
  #preview-phone > section { width: 100%; box-sizing: border-box; }
  .preview-empty {
    margin: 40px 0;
    padding: 18px;
    border: 1px dashed ${options.accent};
    border-radius: 8px;
    text-align: center;
    font-size: 13px;
    line-height: 1.7;
    color: #8b93a1;
    opacity: 0.9;
  }
  .preview-blocked {
    margin: 0 0 14px;
    padding: 10px 12px;
    border-left: 3px solid #dc2626;
    border-radius: 4px;
    background-color: #fef2f2;
    font-size: 12px;
    line-height: 1.6;
    color: #b91c1c;
  }
  img { max-width: 100%; height: auto; }
  .preview-video-block {
    display: block;
    margin-top: 2.5em;
    margin-bottom: 2.5em;
    color: #dc2626;
  }
  .preview-video-placeholder {
    display: block;
    color: #dc2626;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.8;
  }
  .preview-video-notice {
    margin-left: 6px;
    font-size: 12px;
    line-height: 1.7;
    font-weight: 600;
    color: #dc2626;
  }
  .preview-video-player {
    display: block;
    margin: 12px 0 0;
  }
  .preview-video-player video {
    display: block;
    width: 100%;
    max-width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    background: #0f172a;
  }
  .preview-video-unavailable {
    display: block;
    margin: 10px 0 0;
    padding: 10px 12px;
    border: 1px solid #fed7aa;
    border-radius: 8px;
    background: #fff7ed;
    color: #c2410c;
    font-size: 12px;
    line-height: 1.6;
    font-weight: 500;
  }
</style>
</head>
<body>
<section id="preview-phone">
${addVideoPreviews(options.html, options.placeholders ?? [])}
</section>
</body>
</html>
`
}

