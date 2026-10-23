import { dialog, type BrowserWindow } from 'electron'
import { basename } from 'node:path'
import type { ExportResult } from '@shared/contracts/ipc'
import { buildStandaloneDocument } from '@shared/export/standalone'
import { themeService } from './theme-service'
import { snapshotStore } from './snapshot-store'
import { writeFileAtomic } from '../store/atomic-write'

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80) || 'article'
}

export async function exportSnapshotAsHtml(
  request: { snapshotId: string; expectedRevision: number; includeCopyButton: boolean },
  window: BrowserWindow | null,
): Promise<ExportResult> {
  const snapshot = snapshotStore.get(request.snapshotId, request.expectedRevision)
  const theme = themeService.getTheme(snapshot.themeId)
  const documentHtml = buildStandaloneDocument({
    html: snapshot.html,
    title: snapshot.meta.title || '排版助手导出',
    accent: theme.colors.accent,
    background: '#eef1f6',
    textColor: theme.colors.text,
    includeCopyButton: request.includeCopyButton,
  })

  const suggested = `${safeFileName(snapshot.meta.title || 'article')}.html`
  const options = {
    title: '导出 HTML',
    defaultPath: suggested,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  }
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)

  if (result.canceled || !result.filePath) return { saved: false }

  await writeFileAtomic(result.filePath, documentHtml)
  return { saved: true, pathLabel: result.filePath, fileName: basename(result.filePath) } as ExportResult
}
