import { CHANNELS } from '@shared/contracts/ipc'
import type { ExportRequest } from '@shared/contracts/ipc'
import { exportRequestSchema } from '@shared/schemas/ipc'
import { exportSnapshotAsHtml } from '../services/export-service'
import { getMainWindow, handle } from './register'

export function registerExportIpc(): void {
  handle(CHANNELS.exportHtml, exportRequestSchema, (payload) => {
    const request = payload as ExportRequest
    return exportSnapshotAsHtml(request, getMainWindow())
  })
}
