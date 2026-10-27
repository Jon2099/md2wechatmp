<script setup lang="ts">
import { computed } from 'vue'
import ModalShell from '../../components/ModalShell.vue'
import { setAutoSaveInterval, setOption, toggleSettings, view } from '@renderer/state/store'

const autoSaveIntervals: Array<{ value: number; label: string }> = [
  { value: 0, label: '关闭' },
  { value: 3, label: '3 秒 (默认)' },
  { value: 10, label: '10 秒' },
  { value: 30, label: '30 秒' },
  { value: 60, label: '1 分钟' },
  { value: 300, label: '5 分钟' },
]
import type { CodeWrap, ListMode, MathMode, TableFallback } from '@shared/models/compile'

const listModes: Array<{ value: ListMode; label: string; hint: string }> = [
  { value: 'native', label: '微信原生列表', hint: '保留公众号标准列表结构，在后台可自由拖动或调整' },
  { value: 'static', label: '普通文字符号', hint: '用文字符号模拟列表，在各类微信客户端排版最稳定' },
]

const tableFallbacks: Array<{ value: TableFallback; label: string; hint: string }> = [
  { value: 'none', label: '保留表格', hint: '尽量保留表格排版，超宽时自动采用紧凑布局' },
  { value: 'records', label: '转为文字卡片', hint: '超宽表格自动转为逐行卡片，避免手机屏幕横向截断' },
]

const mathModes: Array<{ value: MathMode; label: string; hint: string }> = [
  { value: 'svg', label: '矢量 SVG（推荐）', hint: '转为清晰矢量图，对齐文字基线，粘贴到微信直接可用' },
  { value: 'raw', label: '保留源码', hint: '直接输出 LaTeX 源码（如 $E=mc^2$），不渲染为图片' },
]

const codeWraps: Array<{ value: CodeWrap; label: string }> = [
  { value: 'soft', label: '自动换行' },
  { value: 'scroll', label: '横向滚动' },
]

const listHint = computed(
  () => listModes.find((entry) => entry.value === view.options.listMode)?.hint ?? '',
)

const tableHint = computed(
  () => tableFallbacks.find((entry) => entry.value === view.options.tableFallback)?.hint ?? '',
)

const mathHint = computed(
  () => mathModes.find((entry) => entry.value === view.options.mathMode)?.hint ?? '',
)

const autoSaveHint = computed(() => {
  if (view.autoSaveInterval <= 0) return '已关闭自动保存，仅在手动保存 (Ctrl+S) 时写入文件。'
  const matched = autoSaveIntervals.find((item) => item.value === view.autoSaveInterval)
  return `每隔 ${matched?.label ?? '1 分钟'} 自动保存当前修改。已保存文档写回磁盘，未命名文档自动暂存。`
})
</script>

<template>
  <ModalShell labelledby="settings-modal-title" width="640px" @close="toggleSettings(false)">
    <header class="modal-head">
      <div>
        <h2 id="settings-modal-title" class="modal-title">排版与输出设置</h2>
        <p class="modal-subtitle">只影响复制到微信的排版效果，不会修改你的 Markdown 原文</p>
      </div>
      <button type="button" class="close-btn" aria-label="关闭" @click="toggleSettings(false)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="modal-body">
      <div class="title-option">
        <label class="switch">
          <input
            type="checkbox"
            :checked="view.options.includeTitle"
            aria-describedby="include-title-hint"
            @change="setOption('includeTitle', ($event.target as HTMLInputElement).checked)"
          />
          <span class="switch-content">
            <strong>正文包含文章标题</strong>
            <em id="include-title-hint">关闭后，预览、复制和导出将省略第一个一级标题（# 标题），其他章节标题保留。公众号标题请单独填写。</em>
          </span>
        </label>
      </div>

      <div class="group">
        <p class="group-label">列表处理</p>
        <div class="segment">
          <button
            v-for="item in listModes"
            :key="item.value"
            type="button"
            class="segment-btn"
            :class="{ active: view.options.listMode === item.value }"
            @click="setOption('listMode', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="group-hint">{{ listHint }}</p>
      </div>

      <div class="group">
        <p class="group-label">表格处理</p>
        <div class="segment">
          <button
            v-for="item in tableFallbacks"
            :key="item.value"
            type="button"
            class="segment-btn"
            :class="{ active: view.options.tableFallback === item.value }"
            @click="setOption('tableFallback', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="group-hint">{{ tableHint }}</p>
      </div>

      <div class="group">
        <p class="group-label">代码换行</p>
        <div class="segment">
          <button
            v-for="item in codeWraps"
            :key="item.value"
            type="button"
            class="segment-btn"
            :class="{ active: view.options.codeWrap === item.value }"
            @click="setOption('codeWrap', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="group">
        <p class="group-label">数学公式</p>
        <div class="segment">
          <button
            v-for="item in mathModes"
            :key="item.value"
            type="button"
            class="segment-btn"
            :class="{ active: view.options.mathMode === item.value }"
            @click="setOption('mathMode', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="group-hint">{{ mathHint }}</p>
      </div>

      <div class="switches">
        <label class="switch">
          <input
            type="checkbox"
            :checked="view.options.highlight"
            @change="setOption('highlight', ($event.target as HTMLInputElement).checked)"
          />
          <span class="switch-content">
            <strong>代码语法高亮</strong>
            <em>为常见编程语言提供彩色高亮；关闭后为普通等宽纯文本</em>
          </span>
        </label>

        <label class="switch">
          <input
            type="checkbox"
            :checked="view.options.firstLineIndent"
            @change="setOption('firstLineIndent', ($event.target as HTMLInputElement).checked)"
          />
          <span class="switch-content">
            <strong>正文首行缩进</strong>
            <em>段落开头自动空两格，适合传统文学与报刊排版</em>
          </span>
        </label>
      </div>

      <div class="group">
        <p class="group-label">定时自动保存</p>
        <div class="segment">
          <button
            v-for="item in autoSaveIntervals"
            :key="item.value"
            type="button"
            class="segment-btn"
            :class="{ active: view.autoSaveInterval === item.value }"
            @click="setAutoSaveInterval(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="group-hint">
          {{ autoSaveHint }}
        </p>
      </div>
    </div>

    <footer class="modal-foot">
      <span class="foot-tip">修改后立即在右侧预览中生效</span>
      <button type="button" class="done-btn" @click="toggleSettings(false)">完成</button>
    </footer>
  </ModalShell>
</template>

<style scoped>
.modal-body {
  padding: 18px 26px;
  max-height: min(620px, calc(100vh - 180px));
  overflow-y: auto;
}
.group {
  margin-bottom: 18px;
}
.title-option {
  padding-bottom: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid #f1f5f9;
}
.group-label {
  margin: 0 0 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: #334155;
}
.segment {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
}
.segment-btn {
  flex: 1;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 12.5px;
  font-family: inherit;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.segment-btn:hover {
  color: #1e293b;
}
.segment-btn.active {
  background: #ffffff;
  color: #0f172a;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}
.group-hint {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.45;
}
.switches {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 6px;
  border-top: 1px solid #f1f5f9;
}
.switch {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}
.switch input {
  margin-top: 3px;
  cursor: pointer;
  accent-color: #0f172a;
  width: 15px;
  height: 15px;
}
.switch-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.switch-content strong {
  font-size: 13px;
  color: #1e293b;
  font-weight: 600;
}
.switch-content em {
  font-style: normal;
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.4;
}
</style>
