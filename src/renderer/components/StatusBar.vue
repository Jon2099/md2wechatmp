<script setup lang="ts">
import type { SnapshotStats } from '@shared/models/snapshot'

defineProps<{
  status: string
  stats: SnapshotStats | null
  counts: { info: number; warning: number; error: number; review: number }
  diagnosticsOpen: boolean
  includeTitle: boolean
  themeName?: string
  themeAccent?: string
  canCopy?: boolean
  copyState?: 'idle' | 'copied' | 'failed'
}>()

const emit = defineEmits<{
  toggleDiagnostics: []
  openTheme: []
  copy: []
  'update:includeTitle': [value: boolean]
}>()
</script>

<template>
  <footer class="status-bar">
    <div class="status-left" @click="emit('toggleDiagnostics')">
      <span class="status-dot" :class="{ error: counts.error > 0, warning: counts.warning > 0 && counts.error === 0 }" />
      <span class="status-text" title="点击弹出详情">{{ status }}</span>

      <div v-if="stats" class="chips">
        <span class="chip-divider">/</span>
        <span class="chip">{{ stats.chars }} 字</span>
        <span v-if="stats.images" class="chip">图片 {{ stats.images }}</span>
        <span class="chip">视频占位 {{ stats.placeholders }}</span>
        <span class="chip">链接 {{ stats.links }}</span>
        <span v-if="stats.codeBlocks" class="chip">代码 {{ stats.codeBlocks }}</span>
        <span v-if="stats.tables" class="chip">表格 {{ stats.tables }}</span>
      </div>
    </div>

    <div class="status-right">
      <button
        v-if="themeName"
        type="button"
        class="bar-item-btn theme-btn"
        title="更换排版主题"
        @click="emit('openTheme')"
      >
        <span class="theme-dot" :style="{ backgroundColor: themeAccent ?? '#3b82f6' }" />
        <span class="theme-label">{{ themeName }}</span>
      </button>

      <button
        type="button"
        class="diag-toggle"
        title="查看排版检查详情"
        @click="emit('toggleDiagnostics')"
      >
        <span v-if="counts.error" class="pill error">错误 {{ counts.error }}</span>
        <span v-else-if="counts.warning" class="pill warning">警告 {{ counts.warning }}</span>
        <span v-else class="pill ok">正常</span>
        <span v-if="counts.review" class="pill review">待确认 {{ counts.review }}</span>
        <span class="arrow-hint">详情</span>
      </button>

      <button
        type="button"
        class="bar-item-btn title-toggle"
        :aria-pressed="includeTitle"
        title="控制预览、复制和导出是否包含第一个一级标题"
        @click="emit('update:includeTitle', !includeTitle)"
      >
        <span class="title-switch" aria-hidden="true" />
        <span>包含文章标题</span>
      </button>

      <button
        v-if="copyState !== undefined"
        type="button"
        class="primary copy-btn"
        :class="{ done: copyState === 'copied' }"
        :disabled="!canCopy"
        title="复制到微信公众号 (Ctrl+Shift+C)"
        @click="emit('copy')"
      >
        <svg v-if="copyState === 'copied'" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>{{ copyState === 'copied' ? '已复制' : '复制到微信' }}</span>
      </button>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  min-height: 30px;
  padding: 0 12px;
  background: #ffffff;
  border-top: 1px solid #eef1f6;
  font-size: 12px;
  color: #64748b;
  flex: none;
  user-select: none;
}
.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.12s ease;
}
.status-left:hover {
  background-color: #f1f5f9;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  flex: none;
}
.status-dot.warning {
  background-color: #f59e0b;
}
.status-dot.error {
  background-color: #ef4444;
}
.status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  color: #334155;
}
.chips {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.chip-divider {
  color: #cbd5e1;
  font-size: 11px;
}
.chip {
  font-size: 11.5px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}
.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  margin-left: 8px;
}
.bar-item-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 11.5px;
  font-family: inherit;
  padding: 2px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.bar-item-btn:hover {
  border-color: #cbd5e1;
  color: #0f172a;
  background: #ffffff;
}
.title-toggle {
  min-height: 24px;
  white-space: nowrap;
}
.title-toggle[aria-pressed='true'] {
  color: #1d4ed8;
  border-color: #93b4ed;
  background: #eff6ff;
}
.title-toggle:focus-visible {
  outline: 2px solid #1d4ed8;
  outline-offset: 2px;
}
.title-switch {
  position: relative;
  width: 24px;
  height: 14px;
  flex: none;
  border-radius: 7px;
  background: #64748b;
}
.title-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
}
.title-toggle[aria-pressed='true'] .title-switch {
  background: #1d4ed8;
}
.title-toggle[aria-pressed='true'] .title-switch::after {
  left: 12px;
}
.theme-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.theme-label {
  font-size: 11.5px;
}
.diag-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}
.diag-toggle:hover {
  background: #f1f5f9;
}
.pill {
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 500;
}
.pill.ok {
  background: #ecfdf5;
  color: #059669;
}
.pill.warning {
  background: #fffbeb;
  color: #d97706;
}
.pill.error {
  background: #fef2f2;
  color: #dc2626;
  font-weight: 600;
}
.pill.review {
  background: #f3e8ff;
  color: #7c3aed;
}
.arrow-hint {
  font-size: 11px;
  color: #94a3b8;
}
.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #0f172a;
  background: #0f172a;
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 500;
  font-family: inherit;
  padding: 3px 10px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
}
.copy-btn:hover:not(:disabled) {
  opacity: 0.9;
}
.copy-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  border-color: #cbd5e1;
  background: #94a3b8;
}
.copy-btn.done {
  background: #059669;
  border-color: #059669;
}
</style>
