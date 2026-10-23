import { rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ErrorCode, Md2wError } from '@shared/errors/codes'

export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath)
  const tempPath = join(dir, `.${basename(filePath)}.tmp-${randomUUID()}`)
  try {
    await writeFile(tempPath, content, 'utf8')
    await rename(tempPath, filePath)
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    const message = error instanceof Error ? error.message : '写入失败'
    throw new Md2wError(ErrorCode.FileWriteFailed, `保存失败：${message}`)
  }
}
