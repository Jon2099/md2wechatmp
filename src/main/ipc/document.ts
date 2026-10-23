import { CHANNELS } from '@shared/contracts/ipc'
import {
  recoveryRequestSchema,
  reloadRequestSchema,
  revisionRequestSchema,
  updateSourceSchema,
} from '@shared/schemas/ipc'
import {
  createDocument,
  discardRecovery,
  openDocument,
  reloadDocument,
  saveDocument,
  takeRecovery,
  updateSource,
} from '../services/document-service'
import { getMainWindow, handle } from './register'

export function registerDocumentIpc(): void {
  handle(CHANNELS.docNew, null, () => createDocument())
  handle(CHANNELS.docOpen, null, () => openDocument(getMainWindow()))
  handle(CHANNELS.docReload, reloadRequestSchema, (payload) => {
    const request = payload as { docId: string }
    return reloadDocument(request.docId)
  })
  handle(CHANNELS.docUpdate, updateSourceSchema, (payload) => {
    const request = payload as { docId: string; baseRevision: number; text: string }
    return updateSource(request.docId, request.baseRevision, request.text)
  })
  handle(CHANNELS.docSave, revisionRequestSchema, (payload) => {
    const request = payload as { docId: string; revision: number }
    return saveDocument(request.docId, request.revision, false, getMainWindow())
  })
  handle(CHANNELS.docSaveAs, revisionRequestSchema, (payload) => {
    const request = payload as { docId: string; revision: number }
    return saveDocument(request.docId, request.revision, true, getMainWindow())
  })
  handle(CHANNELS.recoveryTake, recoveryRequestSchema, (payload) => {
    const request = payload as { docId: string }
    return takeRecovery(request.docId)
  })
  handle(CHANNELS.recoveryDiscard, recoveryRequestSchema, (payload) => {
    const request = payload as { docId: string }
    return discardRecovery(request.docId)
  })
}
