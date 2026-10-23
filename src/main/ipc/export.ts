import { CHANNELS } from '@shared/contracts/ipc'
import type { ExportRequest } from '@shared/contracts/ipc'
import type { ThemeSummary } from '@shared/models/theme'
import { exportRequestSchema } from '@shared/schemas/ipc'
import { themeSummaries } from '@themes/builtins/index'
import { exportSnapshotAsHtml } from '../services/export-service'
import { getMainWindow, handle } from './register'

export function registerExportIpc(): void {
  handle(CHANNELS.exportHtml, exportRequestSchema, (payload) => {
    const request = payload as ExportRequest
    return exportSnapshotAsHtml(request, getMainWindow())
  })

  handle<ThemeSummary[]>(CHANNELS.themeList, null, () => themeSummaries())
}
