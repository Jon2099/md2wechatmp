import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { compileDocument } from '../src/converter/index'
import { buildStandaloneDocument } from '../src/shared/export/standalone'
import { DEFAULT_COMPILE_OPTIONS } from '../src/shared/models/compile'
import { getTheme } from '../src/themes/builtins/index'

const [fileArg, themeArg] = process.argv.slice(2)
if (!fileArg) {
  console.error('用法: npm run compile:fixture -- <markdown 文件> [主题 id]')
  process.exit(1)
}

const file = resolve(fileArg)
const source = await readFile(file, 'utf8')
const theme = getTheme(themeArg ?? 'ocean-blue')
const started = Date.now()

const snapshot = await compileDocument({
  baseDir: dirname(file),
  docId: 'doc-fixture',
  revision: 1,
  markdown: source,
  theme,
  options: DEFAULT_COMPILE_OPTIONS,
})

const html = buildStandaloneDocument({
  html: snapshot.html,
  title: snapshot.meta.title || basename(file, '.md'),
  notice: `本页由 md2wechatmp 生成（主题：${theme.name}）。样式已内联，点击右上角复制后到公众号后台粘贴并审核。`,
  accent: theme.colors.accent,
  background: '#eef1f6',
  textColor: theme.colors.text,
  includeCopyButton: true,
})

const outDir = resolve('out/dev')
await mkdir(outDir, { recursive: true })
const outFile = join(outDir, `${basename(file, '.md')}-${theme.id}.html`)
await writeFile(outFile, html, 'utf8')

const summary = snapshot.diagnostics.reduce<Record<string, number>>((acc, item) => {
  acc[item.severity] = (acc[item.severity] ?? 0) + 1
  return acc
}, {})

console.log(`状态：${snapshot.status}`)
console.log(`主题：${theme.name}（${theme.id}）`)
console.log(`耗时：${Date.now() - started} ms`)
console.log(`统计：字符 ${snapshot.stats.chars}｜占位 ${snapshot.stats.placeholders}｜审核项 ${snapshot.stats.reviewItems}｜表格 ${snapshot.stats.tables}｜代码块 ${snapshot.stats.codeBlocks}`)
console.log(`诊断：info ${summary.info ?? 0}｜warning ${summary.warning ?? 0}｜error ${summary.error ?? 0}`)
for (const item of snapshot.diagnostics) {
  if (item.severity === 'error') console.log(`  [错误] ${item.message}`)
}
console.log(`输出：${outFile}`)
