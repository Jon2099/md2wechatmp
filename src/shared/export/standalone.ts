export interface StandaloneOptions {
  html: string
  title: string
  notice?: string
  accent: string
  background: string
  textColor: string
  includeCopyButton: boolean
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const COPY_SCRIPT = `
(function () {
  var btn = document.getElementById('copybtn');
  var box = document.getElementById('copy-content');
  if (!btn || !box) return;
  var label = '一键复制到微信';

  function reset(text, color, delay) {
    btn.textContent = text;
    btn.style.backgroundColor = color;
    setTimeout(function () {
      btn.textContent = label;
      btn.style.backgroundColor = ACCENT;
      btn.disabled = false;
    }, delay);
  }

  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = '正在复制…';
    try {
      var range = document.createRange();
      range.selectNode(box);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      var ok = document.execCommand('copy');
      sel.removeAllRanges();
      if (ok) { reset('已复制，请到后台粘贴并审核', '#0d7a68', 2600); return; }
    } catch (e) {}

    if (navigator.clipboard && window.ClipboardItem) {
      var data = {};
      data['text/html'] = new Blob([box.outerHTML], { type: 'text/html' });
      data['text/plain'] = new Blob([box.innerText], { type: 'text/plain' });
      navigator.clipboard.write([new ClipboardItem(data)]).then(function () {
        reset('已复制，请到后台粘贴并审核', '#0d7a68', 2600);
      }).catch(function () {
        reset('请手动全选复制', '#b45309', 3200);
      });
      return;
    }
    reset('请手动全选复制', '#b45309', 3200);
  });
})();
`

export function injectCopyRootId(html: string): string {
  const start = html.indexOf('<section')
  if (start < 0) return html
  const end = html.indexOf('>', start)
  if (end < 0) return html
  return `${html.slice(0, end)} id="copy-content"${html.slice(end)}`
}

export function buildStandaloneDocument(options: StandaloneOptions): string {
  const content = injectCopyRootId(options.html)
  const title = escapeHtml(options.title)
  const accent = options.accent
  const notice = options.notice
    ? `<section class="page-notice">${escapeHtml(options.notice)}</section>`
    : ''
  const copyBar = options.includeCopyButton
    ? `<section id="copybar"><button id="copybtn" type="button">一键复制到微信</button></section>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="md2wechatmp">
<title>${title}</title>
<style>
  html, body { margin: 0; padding: 0; background-color: ${options.background}; }
  body { padding: 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; color: ${options.textColor}; }
  #copybar { position: fixed; top: 14px; right: 14px; z-index: 99999; }
  #copybtn { font-family: inherit; font-size: 13px; font-weight: 600; color: #ffffff; background-color: ${accent}; border: none; border-radius: 20px; padding: 9px 20px; cursor: pointer; box-shadow: 0 3px 12px rgba(15, 23, 42, 0.25); }
  #copybtn[disabled] { opacity: 0.75; cursor: default; }
  #page-shell { max-width: 709px; margin: 0 auto; padding: 0 16px; box-sizing: border-box; }
  .page-notice { padding: 12px 15px; margin: 0 0 14px; background-color: #f5f7fb; border: 1px solid #e2e8f0; border-radius: 6px; box-sizing: border-box; font-size: 13px; line-height: 1.65; color: #475569; }
  #copy-content { width: 100%; box-sizing: border-box; }
  @media print { #copybar { display: none; } }
</style>
</head>
<body>
${copyBar}
<section id="page-shell">
${notice}
${content}
</section>
<script>${COPY_SCRIPT.replace(/ACCENT/g, JSON.stringify(accent))}</script>
</body>
</html>
`
}
