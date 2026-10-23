# md2wechatmp

把 Markdown 转成**微信公众平台正文可用**的 HTML：所有样式内联，图片直接显示和复制，视频生成文字占位，链接与脚注统一收到文末。

本工具负责文字排版、图片输出、视频占位和复制，不接管微信发布。

在「选项 → 排版输出设置」中可切换「正文包含文章标题」（默认开启）。关闭后，预览、复制与导出的正文会省略第一个顶层一级标题（`# 标题`，也支持 Setext 一级标题），其他章节标题保留。Markdown 原文和文章标题元数据保持完整，选择会自动保存，适合在公众号后台单独填写标题。

## 为什么不直接粘贴 Markdown

公众号后台的编辑器会丢掉 `class`、`<style>`、外链 CSS 和大部分语义标签，只认行内样式与有限标签。所以转换的目标不是「在浏览器里好看」，而是「粘进后台还不散」。本项目按这条约束设计：

- 输出只保留 `section / p / span / strong / em / a / img / ul / ol / li / table / thead / tbody / tr / th / td / br / sub / sup / u / pre / code`。
- 结构角色用内部类名（`md2w-*`）先做样式内联，内联完成后这些类名会被清洗掉，最终 HTML 里没有 `class`、`id`、`data-*`。
- 分隔线、提示块、表格斑马纹都用 `section` + 行内样式表达，不用 `<hr>`、不用伪元素、不用 CSS 变量。
- 图片输出为安全的 `img`：网络图片保留 HTTP(S) 地址，本地图片按 Markdown 文件所在目录定位并嵌入输出；内嵌图片与 SVG 也直接显示。只有视频使用 `TODO： 文件名` 占位。
- 本地/内嵌图片每张上限 10 MB、每篇合计 30 MB；相对路径图片需要先保存 Markdown 文件，无法载入的图片会给出阻断诊断。
- 应用预览会在视频文件名后显示「（本地视频需上传并等待审核，复制不会复制视频）」，并在下方提供播放器；视频不自动播放，可播放、暂停和拖动进度。本地视频相对路径按 Markdown 所在目录解析，网络视频直链也可预览；平台嵌入链接需在原平台查看。
- 播放器和预览提示不进入剪贴板或导出 HTML，公众号输出仍为视频文字占位。视频丢失或格式不支持时只显示预览提示，不阻止复制文章；发布时请在公众号后台上传视频并等待审核。

## 环境要求

- Node.js ≥ 22
- Python ≥ 3.9（仅 `debug.py` 需要）
- Windows、macOS 或 Linux（请在目标操作系统上打包）

## 快速开始

```bash
npm install

npm run dev          # 开发模式，热更新
npm run build        # 类型检查 + 构建 main / preload / renderer / worker
npm start            # 预览构建产物
npm test             # 单元与集成测试
npm run test:electron # 构建并运行真实 Electron 回归（独立测试数据目录）
npm run dist:dir     # 免安装目录包
npm run dist         # 生成安装包
```

## 一键打包（build.py）

安装 Node.js 22 或更新版本以及 Python 3.9 或更新版本后，在对应操作系统运行：

```bash
python build.py       # Windows；自动选择当前 CPU 架构
python3 build.py      # macOS / Linux
```

脚本会在开发依赖缺失时运行 `npm ci --include=dev`，随后重新生成并校验图标、执行 TypeScript 检查、构建应用和打包；任意步骤失败即停止，并返回非零退出码。从其他目录运行脚本时，也会以项目目录为工作目录。输出默认位于 `dist/`。

| 运行系统 | 默认产物 | 签名策略 |
| --- | --- | --- |
| Windows | NSIS `.exe` 安装包 | 应用、安装包和卸载程序均不签名，保留图标与版本信息 |
| macOS | `.dmg` 和 `.zip` | `identity: "-"`，仅 ad-hoc 空签名；不使用开发者证书、不公证，DMG 不签名 |
| Linux | `.AppImage` 和 `.tar.gz` | 不签名 |

Windows 安装器与卸载器通过 `build/installer.nsh` 启用系统 DPI 感知，使用 Microsoft YaHei UI 字体，避免高分屏下整个窗口被 Windows 作为位图放大。NSIS 的现有页面使用系统 DPI 模式；跨不同缩放比例的显示器移动时，仍可能由 Windows 缩放。可运行 `npm run test:installer` 做回归检查（实际 NSIS 编译测试需要 Windows 与编译器），或运行 `node scripts/check-installer-dpi.cjs dist/安装器.exe` 检查最终 EXE 的 DPI 声明。

发布构建只收集 `out/main`、`out/preload`、`out/renderer`，不会将 `out/` 根目录的调试截图、日志和 `out/dev` 示例打入安装包。主进程、预加载及转换进程代码会压缩，不生成或打包 `.map` 调试文件；Electron 界面语言仅保留英语、简体中文和繁体中文。数学公式、代码高亮、视频解码及 GPU 回退组件照常保留。当前没有自动更新功能，Windows 使用完整 7z 压缩安装包，安装器界面与插件再使用 LZMA 压缩，关闭差分更新包优化；将来接入 `electron-updater` 时需重新评估 `nsis.differentialPackage`。运行 `node --test tests/node/package-content.test.cjs` 可检查已生成的 Windows 目录包，默认检查 `dist/slim-final/win-unpacked`，也可通过 `PACKAGED_APP_DIR` 指定目录。

```bash
python build.py --platform windows --arch x64
python3 build.py --platform macos --arch arm64
python3 build.py --platform macos --arch universal  # Intel + Apple Silicon 通用包
python3 build.py --platform linux --arch arm64
python build.py --dir                             # 只生成可运行的应用目录
python build.py --output dist/custom              # 指定输出目录
python build.py --dry-run                         # 只显示计划，不生成文件
python build.py --no-install                      # 不自动安装 npm 依赖
python build.py --install                         # 按锁文件重新安装依赖后打包
```

`--arch` 支持 `x64`、`arm64` 和仅限 macOS 的 `universal`。三平台支持是指同一个脚本可在三种系统上运行；脚本不进行跨操作系统编译。macOS 空签名需要本机 `codesign`，缺失时可先运行 `xcode-select --install` 安装命令行工具。首次打包可能需要联网下载 Electron 和打包工具；`--no-install` 只关闭 npm 依赖安装。

打包子进程不会继承 `CSC_*`、`WIN_CSC_*` 或 Apple 签名/公证凭据，证书自动发现被关闭，发布固定为 `never`，不修改用户的全局环境或证书配置。若使用 nvm，请先用 `nvm use` 选择一个可运行的 Node.js 版本。

验证脚本本身：

```bash
python -m unittest discover -s tests/python -v
```

图标源文件为 `build/icon.svg`，保留现有绿色文档图案。`npm run build` 和 `build.py` 会自动通过 SVG 渲染器生成全部 PNG、Windows ICO 和 macOS ICNS，不依赖 Electron 窗口、显示服务器或系统 DPI。生成器会检查真实像素尺寸、透明度、有效图案、PNG 完整性，以及 ICO/ICNS 内每一层内容；生成失败会停止打包。

```bash
npm run icons        # 重新生成三平台图标
npm run icons:check  # 检查现有图标是否损坏或与源文件不一致
npm run test:icons   # 图标回归测试
```

命令行编译一篇 Markdown（用于核对输出，不启动界面）：

```bash
npx vite-node scripts/compile-fixture.mts tests/fixtures/b300-backpay.md ocean-blue
# 输出到 out/dev/<文件名>-<主题>.html
```

## 一键调试（debug.py）

根目录的 `debug.py` 把调试环境一次拉起：清掉会干扰 Electron 的环境变量、开主进程与渲染进程两个调试端口、自动弹出 DevTools、日志同时落盘。

```bash
python debug.py                  # 开发模式：热更新 + DevTools + 调试端口
python debug.py preview          # 先构建，再以产物启动（验打包后的真实行为）
python debug.py check            # 只体检：Node/依赖/Electron 二进制/端口/残留进程
python debug.py compile tests/fixtures/b300-backpay.md --theme jade
```

| 开关 | 作用 |
| --- | --- |
| `--port 9222` | 渲染进程远程调试端口（`chrome://inspect` 可连） |
| `--main-port 9229` / `--no-inspect` | 主进程 V8 调试端口，或直接关掉 |
| `--no-devtools` | 启动时不自动弹 DevTools |
| `--clean` / `--reset` | 清工作副本 / 连设置文件一起清（验证恢复流程用） |
| `--kill` | 清掉本项目残留的 electron 进程 |
| `--no-build` | preview 模式跳过构建 |
| `--log 路径` | 指定日志文件，默认 `out/debug-<时间>.log` |
| `--timeout 秒` | 启动后到点自动退出（冒烟用） |

两个容易踩的坑它替你处理了：

- 父进程若带着 `ELECTRON_RUN_AS_NODE`，Electron 会退化成纯 Node、界面起不来；
- 残留实例会触发单实例锁，新窗口启动后立刻退出——`check` 会报出来，`--kill` 直接清掉。

主进程断点：`chrome://inspect` → `Configure…` 里加 `127.0.0.1:9229`；渲染进程断点：`chrome://inspect` 里能看到 `127.0.0.1:9222` 下的页面。

冒烟自检（在真实 Electron 运行时里跑，验证打包后的转换进程与整条 IPC 链路）：

```bash
# Windows 下若继承了 ELECTRON_RUN_AS_NODE，需要先清掉它
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/smoke-worker.cjs
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/smoke-app.cjs

# 抓一张界面截图核对排版（输出到 out/）
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/capture-window.cjs out/ui.png
```

## 使用流程

1. 左侧写或粘贴 Markdown，右侧预览随输入自动刷新（按设备宽度 320 / 375 / 430 切换）。
2. 选主题、按需调整「输出选项」：列表处理、表格处理、代码换行、首行缩进、语法高亮。
3. 看底部诊断：有没有阻断错误、哪些项目需要粘贴后人工确认（视频占位、宽表格、脚注等）。
4. 点「复制到微信」——同时写入 HTML 与纯文本，并回读校验；粘贴到公众号后台后按提示审核。
5. 需要留档时点「导出 HTML」，得到一个自带复制按钮的独立页面。

快捷键：`Ctrl/⌘ + S` 保存、`Ctrl/⌘ + Shift + S` 另存为、`Ctrl/⌘ + O` 打开、`Ctrl/⌘ + N` 新建、`Ctrl/⌘ + Enter` 立即转换。

## 转换规则速览

| 来源 | 输出 |
| --- | --- |
| 标题 `#`~`######` | `section` + 行内字号/字重/间距，可按主题自动编号 |
| 段落 | `p`，行高与字距来自主题，首行缩进可选 |
| 列表 | `ul` / `ol`（原生）或文字符号（静态），任务列表转 `☑ / ☐` |
| 引用块 | 静态提示区域 `section`；首行是整行加粗或 `[!NOTE]`/`提示`/`警告` 时升为提示块标题 |
| 表格 | 标准表格；列数 ≥ 4 或字符超长会提示，超宽可改写成逐行文字记录 |
| 代码块 | Shiki 着色的 `pre > code`，每行一个 `section`；也可关闭高亮输出等宽纯文本 |
| 行内代码 | `code` + 底色圆角，`word-break: normal` 避免碎断 |
| 图片 | 保留为 `img`；网络图保留地址，本地图和内嵌图嵌入输出；纯文本回退保留替代文字 |
| 视频 | `TODO： 文件名` 占位；无名视频自动编号，发布前在微信编辑器插入视频替换 |
| 链接 | 正文保留文字，文末生成 `参考链接` 区，正文标 `[链接 N]` |
| 脚注 | 独立命名空间 `[注 N]`，文末汇总 |
| 公式 | 默认转换为内联 SVG，也可选择保留 TeX 源码 |
| 分隔线 | `section` + `height:1px` + 背景色 |
| 前言行 | 只认 `title / author / summary / date / tags / slug / eyebrow / notice`，其余忽略并提示 |

诊断分三级：`info`（说明性，可直接粘）、`warning`（能粘，但建议看一眼）、`error`（阻断，禁止复制）。存在 `error` 时复制按钮不可用，避免把坏结果粘进后台。

## 主题

内置 5 套：深海蓝（默认）、石墨黑、暖陶、青绿、杂志。主题是纯数据（`ThemeProfile`），只改排版参数，不改内容结构与出口 HTML 标签。新增主题只需在 `src/themes/builtins/` 下写一个 `defineTheme` 数据文件并登记到 `index.ts`。

主题里的字号只允许落在白名单档位，颜色只允许十六进制值；生成 CSS 后会再过一遍属性与取值白名单检查（禁止 `var()`、`calc()`、伪元素、`@media`、`!important`、`em/rem/vw/vh`），不通过即阻断。

## 目录结构

```
src/
├─ main/        应用生命周期、IPC、文档/编译/剪贴板/导出服务、转换进程托管
├─ preload/     只暴露公开桥接，不透传任意通道
├─ renderer/    Vue 界面：编辑器、预览、主题、诊断、选项
├─ worker/      转换进程入口（与界面隔离，超时与崩溃可降级）
├─ converter/   12 阶段转换管线：解析 → 规范化 → 各语义转换 → HAST → 内联 → 清洗 → 不变量校验
├─ themes/      主题数据、CSS 生成与安全检查
└─ shared/      IPC 契约、数据模型、运行时校验、错误码、导出壳
tests/          unit / integration / fixtures
docs/           标签格式全景指南、Electron 技术方案与项目结构设计
```

## 质量保证

- 输出不变量：禁止标签、禁止颜色、字号档位、占位数量对账、内容丢失比例、空块检查、样式缺失检查。
- 单元与集成测试覆盖图片直出、视频占位、引用、链接、列表、代码、表格、公式、上下标、主题，以及保存/恢复、设置并发、编译任务归属和关闭时的持久化。
- 新建、打开和关闭时的未保存确认，以及主题、设置、诊断面板使用统一的应用内弹窗。支持 Esc 取消、Tab 焦点约束、关闭后恢复焦点和减少动态效果；未保存确认默认聚焦「继续编辑」。文件选择与另存为保留系统对话框。
- `npm run test:electron` 验证真实桌面运行时里的跨文档撤销、本地/网络图片加载、本地视频预览播放与拖动进度、导出只保留视频占位、恶意公式导出无外部绘制请求、弹窗的默认取消与键盘焦点，以及输入后立即关闭时的草稿保存；测试使用独立数据目录，不读写用户工作副本。
- 剪贴板写入后回读 `text/plain` 与 `text/html` 做一致性校验，失败不静默。
- 渲染进程禁用 Node、开启上下文隔离与沙箱；预览用无脚本的 `sandbox` iframe；导航与新窗口一律拦截。

## 已知边界

- 不支持图床上传、图片下载、公众号草稿箱推送。
- 不支持 `<video>`、`<audio>`、`<iframe>`、SVG 图表等后台不认的结构，遇到会提示并保留文字。
- 数学公式默认生成 SVG，可切换为保留源码；Mermaid 类图表保留源码，需要手工替换为图片或截图。
- 旧版恢复副本若没有记录原文件版本信息，仍可恢复和另存为；无法核验原文件时不会直接覆盖。
