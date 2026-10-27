<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ContentSnapshot } from '@shared/models/snapshot'
import type { PreviewWidth } from '@shared/models/compile'
import { buildPreviewDocument } from './preview-document'
import { readPreviewSelection } from './preview-selection'
import {
  INLINE_FONT_SIZE_PRESETS,
  type InlineTextStyle,
  type SourceTextSelection,
} from '@shared/inline-text-style'

const props = defineProps<{
  snapshot: ContentSnapshot | null
  accent: string
  width: PreviewWidth
  pending: boolean
  stale: boolean
  source: string
  disabled?: boolean
}>()

const WIDTHS: Array<{ value: PreviewWidth; label: string; tooltip: string }> = [
  { value: 320, label: '320', tooltip: '小屏 320px' },
  { value: 375, label: '375', tooltip: '标准屏 375px' },
  { value: 430, label: '430', tooltip: '大屏 430px' },
]

const COLOR_PALETTE = ['#2d2d2d', '#07c160', '#1d4ed8', '#e53935', '#d97706', '#8b5cf6', '#64748b']

const emit = defineEmits<{
  'update:width': [PreviewWidth]
  format: [payload: { snapshotId: string; ranges: SourceTextSelection[]; style: InlineTextStyle }]
}>()

const frame = ref<HTMLIFrameElement | null>(null)
const toolbar = ref<HTMLDivElement | null>(null)
const selection = ref<{ snapshotId: string; ranges: SourceTextSelection[]; left: number; top: number } | null>(null)
const color = ref('#2d2d2d')
const colorChanged = ref(false)
const fontSize = ref('')

const canEdit = computed(() => !!props.snapshot && !props.stale && !props.pending && !props.disabled && props.snapshot.status === 'ok')
const canApply = computed(() => colorChanged.value || !!fontSize.value)

let detachFrame: (() => void) | undefined
let selectTimer: ReturnType<typeof setTimeout> | undefined
let renderedDocId: string | undefined
let previewScrollTop = 0

function closeToolbar(): void { selection.value = null }

function dismissToolbar(): void {
  closeToolbar()
  frame.value?.contentDocument?.getSelection()?.removeAllRanges()
  frame.value?.focus()
}

function updateSelection(): void {
  if (document.activeElement && toolbar.value?.contains(document.activeElement)) return
  if (!canEdit.value || !frame.value?.contentDocument) { closeToolbar(); return }
  const selected = readPreviewSelection(frame.value.contentDocument, props.source)
  if (!selected) { closeToolbar(); return }
  const bounds = frame.value.getBoundingClientRect()
  const width = Math.min(420, window.innerWidth - 24)
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, bounds.left + selected.rect.left + selected.rect.width / 2 - width / 2))
  const selectionTop = bounds.top + selected.rect.top
  const selectionBottom = bounds.top + selected.rect.bottom
  const toolbarHeight = toolbar.value?.offsetHeight || 100
  const gap = 16

  const aboveTop = selectionTop - toolbarHeight - gap
  const belowTop = selectionBottom + gap
  const top = aboveTop >= Math.max(12, bounds.top)
    ? aboveTop
    : Math.min(window.innerHeight - toolbarHeight - 12, belowTop)

  selection.value = { snapshotId: props.snapshot!.id, ranges: selected.ranges, left, top: Math.max(12, top) }
  color.value = selected.color
  colorChanged.value = false
  fontSize.value = ''

  void nextTick(() => {
    if (toolbar.value && selection.value) {
      const realHeight = toolbar.value.offsetHeight
      if (Math.abs(realHeight - toolbarHeight) > 2) {
        const refinedAbove = selectionTop - realHeight - gap
        const refinedBelow = selectionBottom + gap
        const refinedTop = refinedAbove >= Math.max(12, bounds.top)
          ? refinedAbove
          : Math.min(window.innerHeight - realHeight - 12, refinedBelow)
        selection.value.top = Math.max(12, refinedTop)
      }
    }
  })
}

function scheduleSelection(): void {
  clearTimeout(selectTimer)
  selectTimer = setTimeout(updateSelection, 30)
}

function onFrameLoad(): void {
  detachFrame?.()
  const doc = frame.value?.contentDocument
  if (!doc) return
  if (doc.scrollingElement) doc.scrollingElement.scrollTop = previewScrollTop
  renderedDocId = props.snapshot?.docId
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') dismissToolbar()
    if (((event.ctrlKey || event.metaKey) && ['s', 'o', 'n', 'Enter'].includes(event.key)) || event.key === 'F1') {
      event.preventDefault()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey }))
    }
    // Let keyboard selections reach the formatting controls without losing the range.
    if (event.key === 'Tab' && selection.value) { event.preventDefault(); toolbar.value?.querySelector<HTMLInputElement>('input')?.focus() }
  }
  doc.addEventListener('selectionchange', scheduleSelection)
  doc.addEventListener('pointerup', scheduleSelection)
  doc.addEventListener('keydown', onKeydown)
  doc.addEventListener('pointerdown', closeToolbar)
  doc.addEventListener('scroll', closeToolbar, true)
  detachFrame = () => {
    doc.removeEventListener('selectionchange', scheduleSelection)
    doc.removeEventListener('pointerup', scheduleSelection)
    doc.removeEventListener('keydown', onKeydown)
    doc.removeEventListener('pointerdown', closeToolbar)
    doc.removeEventListener('scroll', closeToolbar, true)
  }
}

function applyStyle(): void {
  const current = selection.value
  if (!current || !canEdit.value || current.snapshotId !== props.snapshot?.id) { closeToolbar(); return }
  emit('format', {
    snapshotId: current.snapshotId,
    ranges: current.ranges,
    style: {
      ...(colorChanged.value ? { color: color.value } : {}),
      ...(fontSize.value ? { fontSize: fontSize.value } : {}),
    },
  })
  closeToolbar()
  frame.value?.focus()
}

function outsidePointer(event: PointerEvent): void {
  if (!toolbar.value?.contains(event.target as Node)) closeToolbar()
}

watch(() => [props.snapshot?.id, props.stale, props.pending, props.width, props.disabled], closeToolbar)
onMounted(() => { document.addEventListener('pointerdown', outsidePointer); window.addEventListener('resize', closeToolbar); window.addEventListener('scroll', closeToolbar, true) })
onBeforeUnmount(() => {
  clearTimeout(selectTimer)
  detachFrame?.()
  document.removeEventListener('pointerdown', outsidePointer)
  window.removeEventListener('resize', closeToolbar)
  window.removeEventListener('scroll', closeToolbar, true)
})

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
    html: `${banner}${snapshot.previewHtml ?? snapshot.html}`,
    placeholders: snapshot.placeholders,
    title,
    accent: props.accent,
    width: props.width,
  })
})

watch(srcdoc, () => {
  previewScrollTop = renderedDocId === props.snapshot?.docId ? frame.value?.contentDocument?.scrollingElement?.scrollTop ?? 0 : 0
})
</script>

<template>
  <div class="preview-pane">
    <div class="preview-head">
      <div class="preview-info">
        <span class="preview-title">微信预览</span>
        <span v-if="canEdit" class="preview-edit-hint">选中文字可改样式</span>
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
      <iframe ref="frame" class="preview-frame" sandbox="allow-same-origin" :srcdoc="srcdoc" title="微信预览" @load="onFrameLoad" />
    </div>
  </div>
  <Teleport to="body">
    <div
      v-if="selection"
      ref="toolbar"
      class="selection-toolbar"
      role="toolbar"
      aria-label="选中文字样式"
      :style="{ left: `${selection.left}px`, top: `${selection.top}px` }"
      @keydown.esc.stop="dismissToolbar"
      @pointerdown.stop
    >
      <div class="toolbar-header">
        <div class="header-tag">局部文字样式</div>
        <button type="button" class="selection-close" aria-label="关闭文字样式工具条" title="关闭 (Esc)" @click="dismissToolbar">×</button>
      </div>

      <div class="toolbar-main-row">
        <div class="selection-color-wrap">
          <label class="color-picker-label" title="选择文字颜色">
            <span class="color-circle" :style="{ backgroundColor: color }"></span>
            <input v-model="color" type="color" aria-label="文字颜色" @input="colorChanged = true" />
          </label>
          <div class="quick-colors" title="快捷选色">
            <button
              v-for="c in COLOR_PALETTE"
              :key="c"
              type="button"
              class="color-dot"
              :class="{ active: color === c }"
              :style="{ backgroundColor: c }"
              :title="`颜色 ${c}`"
              @click="color = c; colorChanged = true"
            />
          </div>
        </div>

        <div class="selection-size-wrap">
          <select v-model="fontSize" class="size-select" aria-label="文字字号">
            <option value="">原字号</option>
            <option v-for="item in INLINE_FONT_SIZE_PRESETS" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>

        <button type="button" class="selection-apply" :disabled="!canApply" @click="applyStyle">应用</button>
      </div>

      <div class="selection-note">仅修改选中文字的颜色和字号。</div>
    </div>
  </Teleport>
</template>

<style scoped>
@import './selection-toolbar.css';

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
.preview-edit-hint { color: #64748b; font-size: 11px; }
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
