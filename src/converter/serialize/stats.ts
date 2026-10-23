import type { SnapshotStats } from '@shared/models/snapshot'
import type { CompileContext } from '../pipeline/types'
import type { Diagnostic } from '@shared/models/diagnostic'

export function collectStats(
  plainText: string,
  ctx: CompileContext,
  diagnostics: Diagnostic[],
): SnapshotStats {
  const reviewItems = diagnostics.filter((item) => item.review).length
  const images = ctx.counters.images
  const videos = ctx.placeholders.filter((p) => p.mediaType === 'video').length
  return {
    chars: plainText.length,
    placeholders: ctx.placeholders.length,
    reviewItems,
    links: ctx.links.length,
    footnotes: ctx.footnotes.length,
    codeBlocks: ctx.counters.codeBlocks,
    tables: ctx.counters.tables,
    images,
    videos,
  }
}
