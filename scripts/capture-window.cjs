/**
 * 界面截图探针：加载真实主进程入口，用 capturePage 抓窗口内容，便于人工核对排版。
 * 用法：env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/capture-window.cjs out/ui.png
 */
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

require('../out/main/index.js')

const SAMPLE = `# 把 Markdown 粘进公众号，不再手动调样式

## 数学公式矢量渲染

爱因斯坦著名的质能方程是 $E = mc^2$，其中 $E$ 代表能量，$m$ 代表质量。

高斯积分公式为：

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

> **本篇要点**
> · 所有公式自动转为矢量 SVG，微信后台完美显示
> · 所有样式内联，后台编辑器不会拆掉
> · 链接与脚注统一收到文末

## 一、为什么需要这一步

公众号后台会丢掉 \`class\`、\`<style>\` 和大部分语义标签，只认行内样式。所以转换的目标不是「在浏览器里好看」，而是**粘进后台还不散**。

| 处理环节 | 传统做法 | 本工具 |
| --- | --- | --- |
| 样式 | 手工挑选内联 | 主题统一生成并校验 |
| 图片 | 一张张上传 | 文字占位，粘贴后替换 |
| 链接 | 留一堆裸链接 | 收到文末参考链接 |

![流程图](https://example.com/assets/pipeline.png)

<video src="demo-preview.mp4" controls></video>

## 二、操作顺序

1. 左侧写 Markdown；
2. 右侧看微信宽度下的实际效果；
3. 点「复制到微信」，到后台粘贴并审核。

> [!WARNING]
> 图片与视频占位必须在后台逐个替换成真实媒体文件，否则文章会带着 TODO 发布。

\`\`\`ts
const snapshot = await compile({ themeId: 'ocean-blue' })
console.log(snapshot.stats.placeholders)
\`\`\`

## 三、数学公式

爱因斯坦著名的质能方程是 $E = mc^2$，其中 $E$ 代表能量，$m$ 代表质量，$c$ 代表光速。

高斯积分公式为：

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

细节见 [微信公众平台](https://mp.weixin.qq.com) 的排版说明[^1]。

[^1]: 脚注会统一编号并收到文末。
`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  await sleep(3500)

  // 关闭启动帮助弹窗
  await win.webContents.executeJavaScript(`(() => {
    const btn = document.querySelector('.done-btn')
    if (btn) btn.click()
  })()`)
  await sleep(600)

  const SAMPLE_ARTICLE = '# 晨光与读书的时光\n\n每天清晨的一杯温水与半小时阅读，是唤醒身心最好的仪式。\n\n> **核心思考**\n> 慢下来不是停滞，而是为了把目光留给真正重要的事情。\n\n## 一、生活与阅读的节奏\n\n阅读从来不是为了追赶进度，而是为了在字里行间找到内心的共鸣。\n\n| 时段 | 推荐读物 | 预期收获 |\n| :--- | :--- | :--- |\n| 清晨 | 人文随笔、诗歌 | 唤醒感知与思考 |\n| 午间 | 行业干货、工具书 | 解决当下实际问题 |\n| 深夜 | 传记散文、小说 | 抚平一天的疲惫 |\n\n- 记录每次触动你的金句与感受\n- 尝试用自己的话复述核心观点\n- 定期复盘生活方式与阅读感悟\n\n[微信公众平台排版设计](https://mp.weixin.qq.com)'

  await win.webContents.executeJavaScript(`(() => {
    const host = document.querySelector('.cm-content')
    if (!host) return false
    host.focus()
    document.execCommand('selectAll', false, null)
    document.execCommand('insertText', false, ${JSON.stringify(SAMPLE_ARTICLE)})
    return true
  })()`)
  await sleep(3000)

  const brainDir = 'C:/Users/Jonathan/.gemini/antigravity/brain/d9521e6b-735a-4e38-b11e-fd61a7826b5a'

  // Capture Amber
  win.webContents.send('md2w:menu:action', 'theme:select:amber')
  await sleep(1500)
  const amberImg = await win.webContents.capturePage()
  writeFileSync(resolve(brainDir, 'theme-amber-sample.png'), amberImg.toPNG())
  console.log('CAPTURED theme-amber-sample.png')

  // Capture Violet
  win.webContents.send('md2w:menu:action', 'theme:select:violet')
  await sleep(1500)
  const violetImg = await win.webContents.capturePage()
  writeFileSync(resolve(brainDir, 'theme-violet-sample.png'), violetImg.toPNG())
  console.log('CAPTURED theme-violet-sample.png')

  // Capture Ink
  win.webContents.send('md2w:menu:action', 'theme:select:ink')
  await sleep(1500)
  const inkImg = await win.webContents.capturePage()
  writeFileSync(resolve(brainDir, 'theme-ink-sample.png'), inkImg.toPNG())
  console.log('CAPTURED theme-ink-sample.png')

  app.exit(0)
})
