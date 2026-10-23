import { Md2wError, ErrorCode } from '@shared/errors/codes'
import type { CompileLimits } from '../pipeline/types'

export function checkInputLimits(source: string, limits: CompileLimits): void {
  if (typeof source !== 'string') {
    throw new Md2wError(ErrorCode.InvalidInput, '输入内容不是文本。')
  }
  if (source.length > limits.maxChars) {
    throw new Md2wError(
      ErrorCode.LimitExceeded,
      `内容长度 ${source.length} 字，超过上限 ${limits.maxChars} 字。`,
    )
  }
  const bytes = new TextEncoder().encode(source).length
  if (bytes > limits.maxBytes) {
    throw new Md2wError(
      ErrorCode.LimitExceeded,
      `内容体积 ${Math.round(bytes / 1024)} KB，超过上限 ${Math.round(limits.maxBytes / 1024)} KB。`,
    )
  }
}
