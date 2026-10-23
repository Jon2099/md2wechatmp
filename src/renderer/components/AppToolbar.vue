<script setup lang="ts">
const props = defineProps<{
  fileName: string
  pathLabel: string
  dirty: boolean
  pending: boolean
  canCopy: boolean
  canExport: boolean
  copyState: 'idle' | 'copied' | 'failed'
  copyMessage: string
}>()

const emit = defineEmits<{
  new: []
  open: []
  save: []
  saveAs: []
  copy: []
  export: []
  settings: []
  diagnostics: []
  recompile: []
}>()

const copyLabel = () => {
  if (props.pending) return '转换中…'
  if (props.copyState === 'copied') return '已复制，去后台粘贴'
  if (props.copyState === 'failed') return '重新复制'
  return '复制到微信'
}
</script>

<template>
  <header class="toolbar">
    <div class="brand">
      <span class="logo">排</span>
      <span class="brand-name">排版助手</span>
    </div>

    <div class="file-group">
      <button type="button" class="ghost" @click="emit('new')">新建</button>
      <button type="button" class="ghost" @click="emit('open')">打开</button>
      <button type="button" class="ghost" @click="emit('save')">保存</button>
      <button type="button" class="ghost" @click="emit('saveAs')">另存为</button>
    </div>

    <div class="file-name" :title="pathLabel">
      <span class="dot" :class="{ dirty }" />
      <span class="name">{{ fileName }}</span>
      <span v-if="dirty" class="dirty-text">未保存</span>
    </div>

    <div class="actions">
      <button type="button" class="ghost" :disabled="pending" @click="emit('recompile')">
        重新转换
      </button>
      <button type="button" class="ghost" @click="emit('diagnostics')">诊断</button>
      <button type="button" class="ghost" @click="emit('settings')">选项</button>
      <button type="button" class="ghost" :disabled="!canExport" @click="emit('export')">
        导出 HTML
      </button>
      <button
        type="button"
        class="primary"
        :class="{ done: copyState === 'copied' }"
        :disabled="!canCopy"
        :title="copyMessage || '把行内样式 HTML 与纯文本同时写入剪贴板'"
        @click="emit('copy')"
      >
        {{ copyLabel() }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 52px;
  padding: 0 14px;
  background: #ffffff;
  border-bottom: 1px solid #e8ecf2;
  flex: none;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  letter-spacing: 0.02em;
}
.brand-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.01em;
}
.file-group {
  display: flex;
  gap: 2px;
  padding-left: 8px;
  border-left: 1px solid #eef1f6;
}
.file-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12.5px;
  color: #64748b;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cbd5e1;
  flex: none;
}
.dot.dirty {
  background: #f59e0b;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}
.dirty-text {
  color: #b45309;
  font-size: 11.5px;
}
.actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ghost {
  border: 1px solid transparent;
  background: transparent;
  color: #475569;
  font-size: 12.5px;
  font-family: inherit;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.ghost:hover:not(:disabled) {
  background: #f4f6fa;
  color: #1f2937;
}
.ghost:disabled {
  color: #cbd5e1;
  cursor: default;
}
.primary {
  border: none;
  background: #1d4ed8;
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  padding: 8px 16px;
  border-radius: 9px;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
}
.primary:hover:not(:disabled) {
  background: #1a45c0;
}
.primary:active:not(:disabled) {
  transform: translateY(1px);
}
.primary:disabled {
  background: #c7d3ea;
  cursor: default;
}
.primary.done {
  background: #0d7a68;
}
</style>
