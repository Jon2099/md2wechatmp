import { CHANNELS } from '@shared/contracts/ipc'
import type { CompileRequest } from '@shared/models/compile'
import { cancelRequestSchema, compileRequestSchema } from '@shared/schemas/ipc'
import type { CompileService } from '../services/compile-service'
import { getDocumentBaseDir, getDocumentState, getDocumentText } from '../services/document-service'
import { ErrorCode, Md2wError } from '@shared/errors/codes'
import { handle } from './register'

export function registerCompileIpc(service: CompileService): void {
  handle(CHANNELS.compileRequest, compileRequestSchema, (payload) => {
    const request = payload as CompileRequest
    if (getDocumentState(request.docId)?.revision !== request.revision) {
      throw new Md2wError(ErrorCode.SnapshotStale, '内容已更新，请重新转换。')
    }
    return service.request({
      baseDir: getDocumentBaseDir(request.docId),
      docId: request.docId,
      revision: request.revision,
      markdown: getDocumentText(request.docId),
      themeId: request.themeId,
      options: request.options,
    })
  })

  handle(CHANNELS.compileCancel, cancelRequestSchema, (payload) => {
    const request = payload as { taskId: string }
    return service.cancel(request.taskId)
  })
}
