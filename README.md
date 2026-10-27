# md2wechatmp

把 Markdown 转成**微信公众平台正文可用**的 HTML：所有样式内联，图片直接显示和复制，视频生成文字占位，链接与脚注统一收到文末。

本工具负责文字排版、图片输出、视频占位和复制，不接管微信发布。

在底部栏「复制到微信」左侧可切换「包含文章标题」（默认开启），也可在「选项 → 排版输出设置」中切换「正文包含文章标题」，两处保持同步。关闭后，预览、复制与导出的正文会省略第一个顶层一级标题（`# 标题`，也支持 Setext 一级标题），其他章节标题保留。Markdown 原文和文章标题元数据保持完整，选择会自动保存，适合在公众号后台单独填写标题。

## 为什么不直接粘贴 Markdown

公众号后台的编辑器会丢掉 `class`、`<style>`、外链 CSS 和大部分语义标签，只认行内样式与有限标签。所以转换的目标不是「在浏览器里好看」，而是「粘进后台还不散」。本项目按这条约束设计：

- 输出只保留 `section / p / span / strong / em / a / img / ul / ol / li / table / thead / tbody / tr / th / td / br / sub / sup / u / pre / code`。
- 结构角色用内部类名（`md2w-*`）先做样式内联，内联完成后这些类名会被清洗掉，最终 HTML 里没有 `class`、`id`、`data-*`。
- 分隔线、提示块、表格斑马纹都用 `section` + 行内样式表达，不用 `<hr>`、不用伪元素、不用 CSS 变量。
- 图片输出为安全的 `img`：网络图片保留 HTTP(S) 地址，本地图片按 Markdown 文件所在目录定位并嵌入输出；内嵌图片与 SVG 也直接显示。只有视频使用 `TODO： 文件名` 占位。
- 本地/内嵌图片每张上限 10 MB、每篇合计 30 MB；相对路径图片需要先保存 Markdown 文件，无法载入的图片会给出阻断诊断。
- 应用预览会在视频文件名后显示「（本地视频需上传并等待审核，复制不会复制视频）」，并在下方提供播放器；视频不自动播放，可播放、暂停和拖动进度。本地视频相对路径按 Markdown 所在目录解析，网络视频直链也可预览；平台嵌入链接需在原平台查看。
- 播放器和预览提示不进入剪贴板或导出 HTML，公众号输出仍为视频文字占位。视频丢失或格式不支持时只显示预览提示，不阻止复制文章；发布时请在公众号后台上传视频并等待审核。
- 视频文件支持普通链接 `[视频](assets/demo.mp4)`、引用式链接、网络自动链接、图片语法 `![视频](assets/demo.mp4)` 和 HTML `<video>` 标签，均在正文原位置生成 `TODO： demo.mp4`，不会作为普通链接收录到文末。

## 环境要求

- Node.js ≥ 22
- Python ≥ 3.9（`build.py` 一键打包和 `debug.py` 调试需要）
- Windows、macOS 或 Linux（请在目标操作系统上打包）

## 快速开始

```bash
npm install

npm run dev          # 开发模式，热更新
npm run build        # 类型检查 + 构建 main / preload / renderer / worker
npm start            # 预览构建产物
npm test             # 单元与集成测试
npm run test:electron # 构建并运行真实 Electron 回归（独立测试数据目录）
npm run dist:dir     # Windows 免安装目录包
npm run dist         # Windows NSIS 安装包；其他系统使用下方 build.py
```

Electron 42+ 不再在依赖包安装时自动下载运行文件。本项目通过 `postinstall` 补齐，默认使用国内镜像，也可通过 `ELECTRON_MIRROR` 环境变量覆盖。如果此前已经安装依赖，或使用了 `--ignore-scripts`，请执行 `npm run electron:install`，再运行 `python debug.py`。仅安装生产依赖时会跳过下载；CI 如无需桌面运行时，可设置 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`。

镜像配置存放在 `package.json` 的 `config` 中，避免新版 npm 对 `.npmrc` 中的自定义配置发出警告。间接依赖的 `deprecated` 提示不会直接阻止启动。`electron-winstaller` 的脚本审批提示对应未使用的 Squirrel 打包器；本项目使用 NSIS，修复 Electron 运行文件无需批准该脚本。

## 一键打包（build.py）

`build.py` 负责预检和组织构建：先用 `electron-vite` 构建应用，再由 `electron-builder` 生成对应平台的分发文件；Windows 安装程序使用 NSIS。

### 从源码生成安装包

1. 准备项目源码，安装 Node.js 22 或更新版本、Python 3.9 或更新版本，并确保终端能运行 `node`、`npm` 和 `python`（macOS / Linux 通常为 `python3`）。
2. 在终端进入项目根目录，也就是同时包含 `package.json` 和 `build.py` 的目录。
3. 按当前系统执行以下命令；无需先手动运行 `npm run build`。

Windows（PowerShell / CMD）：

```powershell
python build.py
# 如果系统只提供 Python 启动器，也可使用：py -3 build.py
```

macOS：

```bash
python3 build.py
# 同时支持 Intel 与 Apple Silicon 的通用包：
python3 build.py --arch universal
```

Linux：

```bash
python3 build.py
```

默认自动选择当前 CPU 架构。脚本会在开发依赖缺失时运行 `npm ci --include=dev`，随后重新生成并校验图标、执行 TypeScript 检查、构建应用和打包；任意步骤失败即停止，并返回非零退出码。从其他目录运行脚本时，也会以项目目录为工作目录。输出默认位于项目根目录下的 `dist/`。

| 运行系统 | 默认产物 | 签名策略 |
| --- | --- | --- |
| Windows | NSIS `.exe` 安装包 | 应用、安装包和卸载程序均不签名，保留图标与版本信息 |
| macOS | `.dmg` 和 `.zip` | `identity: "-"`，仅 ad-hoc 空签名；不使用开发者证书、不公证，DMG 不签名 |
| Linux | `.AppImage` 和 `.tar.gz` | 不签名 |

### 找到并使用打包产物

打包成功后，终端会显示输出目录。Windows x64、当前版本 `0.1.0` 的安装包为 `dist/md2wechatmp-0.1.0-win-x64.exe`，双击即可安装；版本号取自 `package.json`。macOS 使用生成的 `.dmg` 或 `.zip`，Linux 使用 `.AppImage` 或 `.tar.gz`。

需要免安装运行时，使用 `--dir`：

```powershell
python build.py --dir --output dist/portable
```

例如 Windows x64 的应用位于 `dist/portable/win-unpacked/`，可运行其中的 `排版助手.exe`。分发目录包时需保留整个应用目录，不能只复制其中的 EXE。macOS / Linux 使用同样的参数，将命令中的 `python` 换成 `python3`。

### 常用参数与构建验证

开发时可先运行测试，再生成单独存放的发布包：

```bash
npm test                 # 单元与集成测试
npm run test:electron    # 构建并进行真实 Electron 回归验证
python build.py --no-install --output dist/release
```

macOS / Linux 最后一行使用 `python3`。`build.py` 会执行类型检查，但不会自动运行上述测试；`--no-install` 适合依赖已经完整安装的环境，仍会重新构建最新源码并打包。

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

### 在预览中修改局部文字样式

选中右侧预览中的文字，会弹出颜色与字号工具条。选择颜色或字号后点击「应用」，样式会写回左侧 Markdown；可用编辑器撤销，保存 `.md` 后重新打开、切换主题、复制或导出时都会保留。未手动设置的正文仍固定为 `#2d2d2d`，标题、加粗和链接保留主题配色。字体使用设备本地字体及回退字体，不下载字体文件，最终显示取决于阅读设备。

工具条仅支持颜色和字号，不提供字体选择、下载或安装检测；主题编辑器也不提供字体族选择。旧 Markdown 中的局部 `font-family` 声明会在转换时忽略，文字、颜色和字号继续保留。

局部格式使用受支持的行内 HTML，例如：

```html
正文 <span style="color:#e53935;font-size:18px">选中的文字</span>。
```

代码、公式、自动编号和视频提示等生成内容不支持局部编辑。转换中或预览过期时暂停编辑，避免修改旧选区。选中后可按 `Tab` 进入工具条，`Esc` 关闭。只接受六位十六进制颜色和 10–48px 的整数字号，其他 CSS 和事件属性会被移除。预览位置标记只用于编辑，不进入复制与导出结果。

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
