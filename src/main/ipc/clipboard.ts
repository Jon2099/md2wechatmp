import { CHANNELS } from '@shared/contracts/ipc'
import type { CopyRequest } from '@shared/contracts/ipc'
import { copyRequestSchema } from '@shared/schemas/ipc'
import { copySnapshot } from '../services/clipboard-service'
import { handle } from './register'

export function registerClipboardIpc(): void {
  handle(CHANNELS.clipboardCopy, copyRequestSchema, (payload) => {
    const request = payload as CopyRequest
    return copySnapshot(request.snapshotId, request.expectedRevision)
  })
}
