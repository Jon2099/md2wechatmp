import type { ContentSnapshot } from '@shared/models/snapshot'
import { ErrorCode, Md2wError } from '@shared/errors/codes'

const CAPACITY = 8

class SnapshotStore {
  private items = new Map<string, ContentSnapshot>()
  private order: string[] = []

  put(snapshot: ContentSnapshot): void {
    this.items.set(snapshot.id, snapshot)
    this.order = this.order.filter((id) => id !== snapshot.id)
    this.order.push(snapshot.id)
    while (this.order.length > CAPACITY) {
      const oldest = this.order.shift()
      if (oldest) this.items.delete(oldest)
    }
  }

  get(snapshotId: string, expectedRevision: number): ContentSnapshot {
    const snapshot = this.items.get(snapshotId)
    if (!snapshot) {
      throw new Md2wError(ErrorCode.SnapshotMissing, '转换结果已失效，请重新转换。')
    }
    if (snapshot.revision !== expectedRevision) {
      throw new Md2wError(ErrorCode.SnapshotStale, '内容已更新，请重新转换后再复制。')
    }
    if (snapshot.status === 'blocked') {
      throw new Md2wError(ErrorCode.SnapshotBlocked, '当前内容存在阻断错误，无法复制。')
    }
    return snapshot
  }

  clear(): void {
    this.items.clear()
    this.order = []
  }
}

export const snapshotStore = new SnapshotStore()
