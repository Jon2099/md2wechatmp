<script setup lang="ts">
import { computed } from 'vue'
import type { ContentSnapshot } from '@shared/models/snapshot'
import type { PreviewWidth } from '@shared/models/compile'
import { buildPreviewDocument } from './preview-document'

const props = defineProps<{
  snapshot: ContentSnapshot | null
  accent: string
  width: PreviewWidth
  pending: boolean
  stale: boolean
}>()

const WIDTHS: Array<{ value: PreviewWidth; label: string; tooltip: string }> = [
  { value: 320, label: '320', tooltip: '小屏 320px' },
  { value: 375, label: '375', tooltip: '标准屏 375px' },
  { value: 430, label: '430', tooltip: '大屏 430px' },
]

const emit = defineEmits<{ 'update:width': [PreviewWidth] }>()

const blockedErrors = computed(() => {
  const snapshot = props.snapshot
  if (!snapshot) return []
  return snapshot.diagnostics.filter((item) => item.severity === 'error').slice(0, 3)
})

const srcdoc = computed(() => {
  const snapshot = props.snapshot
  const title = snapshot?.meta.title || '预览'
  if (!snapshot) {
    return buildPreviewDocument({
      html: '<section class="preview-empty">在左侧输入 Markdown，实时得到微信排版效果。</section>',
      title,
      accent: props.accent,
      width: props.width,
    })
  }
  const banner =
    snapshot.status === 'blocked'
      ? `<section class="preview-blocked">存在阻断错误，不可复制：${
          blockedErrors.value.map((item) => item.message).join('；') || '请点击底部诊断查看'
        }</section>`
      : ''
  return buildPreviewDocument({
    html: `${banner}${snapshot.html}`,
    placeholders: snapshot.placeholders,
    title,
    accent: props.accent,
    width: props.width,
  })
})
</script>

<template>
  <div class="preview-pane">
    <div class="preview-head">
      <div class="preview-info">
        <span class="preview-title">微信预览</span>
        <span v-if="stale" class="preview-flag stale">修改中</span>
        <span v-else-if="pending" class="preview-flag pending">转换中</span>
      </div>

      <div class="width-switch">
        <button
          v-for="item in WIDTHS"
          :key="item.value"
          type="button"
          class="width-btn"
          :class="{ active: width === item.value }"
          :title="item.tooltip"
          @click="emit('update:width', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
    <div class="preview-stage">
      <iframe class="preview-frame" sandbox="" :srcdoc="srcdoc" title="微信预览" />
    </div>
  </div>
</template>

<style scoped>
.preview-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: #f1f4f9;
}
.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  background: #f8fafc;
  border-bottom: 1px solid #eef1f6;
  flex: none;
}
.preview-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.01em;
}
.preview-flag {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 500;
}
.preview-flag.stale {
  color: #b45309;
  background: #fef3c7;
}
.preview-flag.pending {
  color: #2563eb;
  background: #dbeafe;
}
.width-switch {
  display: flex;
  gap: 2px;
  background: #e2e8f0;
  border-radius: 6px;
  padding: 2px;
}
.width-btn {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  transition: all 0.12s ease;
}
.width-btn.active {
  background: #ffffff;
  color: #0f172a;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.preview-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 10px 24px;
  display: flex;
  justify-content: center;
}
.preview-frame {
  display: block;
  width: 100%;
  max-width: 480px;
  height: 100%;
  min-height: 480px;
  border: none;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06);
}
</style>
