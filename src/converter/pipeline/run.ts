import { createHash } from 'node:crypto'
import type { ContentSnapshot } from '@shared/models/snapshot'
import type { CompileInput, ConverterDeps } from './types'
import { DEFAULT_LIMITS } from './types'
import { createContext } from './context'
import { checkInputLimits } from '../validate/limits'
import { parseMarkdown } from '../parse/markdown'
import { splitFrontMatter } from '../parse/frontmatter'
import { normalizeDocument } from '../normalize/document'
import { applyTitlePolicy } from '../normalize/title'
import { transformMedia } from '../transforms/image'
import { resolveLinks } from '../transforms/link'
import { resolveFootnotes } from '../transforms/footnote'
import { applyTablePolicy } from '../transforms/table'
import { flagTaskLists } from '../transforms/task-list'
import { flagMath } from '../transforms/math'
import { highlightCodeBlocks } from '../transforms/code'
import { buildHast } from '../html/build-hast'
import type { HNode } from '../html/build-hast'
import { buildThemeCss, assertSafeCss } from '../../themes/build-css'
import { serializeHast } from '../serialize/html'
import { serializePlainText } from '../serialize/plain-text'
import { sanitizeFragment } from '../sanitize/sanitize'
import { checkInvariants } from '../validate/invariants'
import { collectStats } from '../serialize/stats'
import { createDiagnosticSink } from './context'
import { CONVERTER_VERSION, COMPAT_VERSION } from '@shared/versions'

function hashOf(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function snapshotId(input: CompileInput, sourceHash: string): string {
  const optionsHash = hashOf(JSON.stringify(input.options)).slice(0, 8)
  return `snap-${sourceHash.slice(0, 10)}-${input.theme.id}-${input.revision}-${optionsHash}`
}

export async function runPipeline(input: CompileInput, deps: ConverterDeps): Promise<ContentSnapshot> {
  checkInputLimits(input.markdown, DEFAULT_LIMITS)

  const sourceHash = hashOf(input.markdown)
  const sink = createDiagnosticSink()
  const parsed = parseMarkdown(input.markdown)
  const { root, meta } = splitFrontMatter(parsed, sink)
  const ctx = createContext(input, sourceHash, meta, sink)
  ctx.checkAbort()

  const omittedTitleChars = applyTitlePolicy(root, ctx)
  normalizeDocument(root, ctx)
  await transformMedia(root, ctx)
  resolveLinks(root, ctx)
  resolveFootnotes(root, ctx)
  applyTablePolicy(root, ctx)
  flagTaskLists(root, ctx)
  flagMath(root, ctx)

  await highlightCodeBlocks(root, ctx, deps)
  ctx.checkAbort()

  if (ctx.counters.codeBlocks > DEFAULT_LIMITS.maxCodeBlocks) {
    ctx.diagnostics.push({
      code: 'limit.exceeded',
      severity: 'error',
      message: `单篇文章代码块过多（${ctx.counters.codeBlocks} 个），超过微信推荐上限（${DEFAULT_LIMITS.maxCodeBlocks} 个）。`,
      action: '为防粘贴卡顿已暂停直接复制，建议精简或分篇发布。',
      advice: '微信后台对大量代码块支持较弱，容易引起手机端滑动卡顿，建议合并或拆篇。',
      review: true,
    })
  }

  const hast = buildHast(root, ctx)
  const { css, classes } = buildThemeCss(ctx.theme, ctx.options)
  assertSafeCss(css)

  const usedClasses = new Set<string>()
  const collect = (node: HNode): void => {
    if (node.type !== 'element') return
    for (const name of node.properties.className ?? []) usedClasses.add(name)
    node.children.forEach(collect)
  }
  collect(hast)
  const missingClasses = Array.from(usedClasses).filter((name) => !classes.has(name))
  if (missingClasses.length > 0) {
    ctx.diagnostics.push({
      code: 'theme.missing-class',
      severity: 'error',
      message: `排版主题缺少样式定义：${missingClasses.join('、')}`,
      review: true,
    })
  }

  const plainText = serializePlainText(hast)
  const rawHtml = serializeHast(hast)
  const inlined = deps.inliner.inline(rawHtml, css)
  const sanitized = sanitizeFragment(inlined, ctx.theme)

  if (sanitized.report.droppedTags.length > 0) {
    ctx.diagnostics.push({
      code: 'sanitize.dropped-node',
      severity: 'warning',
      message: `检测到微信不兼容的标签：${Array.from(new Set(sanitized.report.droppedTags)).join('、')}，已自动清理。`,
      action: '已保留正文文字并移除不兼容标签，确保粘贴时不发生错位。',
      review: true,
    })
  }

  const invariantDiagnostics = checkInvariants({
    html: sanitized.html,
    text: sanitized.text,
    plainText,
    theme: ctx.theme,
    placeholders: ctx.placeholders.map((record) => record.text),
    sourceChars: Math.max(0, ctx.source.length - ctx.counters.imageSourceChars - omittedTitleChars),
  })

  const diagnostics = [...ctx.diagnostics.list(), ...invariantDiagnostics]
  const status = diagnostics.some((item) => item.severity === 'error') ? 'blocked' : 'ok'
  const stats = collectStats(plainText, ctx, diagnostics)

  return {
    id: snapshotId(input, sourceHash),
    docId: input.docId,
    revision: input.revision,
    themeId: ctx.theme.id,
    options: ctx.options,
    status,
    html: sanitized.html,
    plainText,
    diagnostics,
    meta: ctx.meta,
    stats,
    placeholders: ctx.placeholders,
    links: ctx.links,
    footnotes: ctx.footnotes,
    sourceHash,
    converterVersion: CONVERTER_VERSION,
    compatVersion: COMPAT_VERSION,
    createdAt: Date.now(),
  }
}
