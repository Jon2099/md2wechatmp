<script setup lang="ts">
import { computed, ref } from 'vue'
import ModalShell from '../../components/ModalShell.vue'
import type { Diagnostic } from '@shared/models/diagnostic'

const props = defineProps<{ items: Diagnostic[]; pending: boolean }>()
const emit = defineEmits<{ jump: [line: number]; close: [] }>()

const filter = ref<'all' | 'warning' | 'error' | 'info'>('all')

const LABELS: Record<string, string> = {
  info: '提示',
  warning: '警告',
  error: '错误',
}

const CODE_TITLES: Record<string, string> = {
  'callout.converted': '重点提示卡片',
  'quote.flattened': '多层引用已合并',
  'table.wide': '超宽表格紧凑显示',
  'table.too-many-columns': '超多列表格提醒',
  'table.fallback-records': '超宽表格转文字卡片',
  'code.long-line': '长代码行自动折行',
  'diagram.source-block': '图表代码块（未渲染）',
  'code.unknown-language': '普通等宽代码块',
  'code.highlight-fallback': '代码高亮降级为纯文本',
  'image.load-failed': '图片无法载入',
  'video.placeholder': '视频占位（发布前需插入）',
  'video.unnamed': '无名视频（已自动编号）',
  'video.decode-failed': '视频文件名含特殊字符',
  'image.link-dropped': '图片外链已取消跳转',
  'link.reference': '外链已收纳至文末',
  'link.deduped': '重复网址已合并编号',
  'link.blocked-protocol': '非安全链接已拦截',
  'footnote.missing': '正文脚注缺少文末说明',
  'footnote.unreferenced': '文末脚注未在正文中引用',
  'tasklist.static': '待办复选框排版',
  'math.error': '数学公式语法错误',
  'math.block-review': '公式源码排版',
  'math.inline': '行内公式保留源码',
  'html.unsupported-tag': '不兼容的 HTML 标签已清理',
  'markdown.unresolved-reference': '缺少参考链接定义',
  'frontmatter.ignored-key': '跳过未支持的头部属性',
  'limit.exceeded': '内容超出微信推荐上限',
  'invariant.violation': '排版规范校验未通过',
}

const visible = computed(() => {
  const items = props.items
  const filtered = filter.value === 'all' ? items : items.filter((item) => item.severity === filter.value)
  const order = { error: 0, warning: 1, info: 2 } as const
  return [...filtered].sort((left, right) => {
    const bySeverity = order[left.severity] - order[right.severity]
    if (bySeverity !== 0) return bySeverity
    return (left.span?.line ?? 0) - (right.span?.line ?? 0)
  })
})

const counts = computed(() => {
  const result = { all: props.items.length, info: 0, warning: 0, error: 0 }
  for (const item of props.items) result[item.severity] += 1
  return result
})

function handleJump(line: number) {
  emit('jump', line)
  emit('close')
}
</script>

<template>
  <ModalShell labelledby="diag-modal-title" width="680px" @close="emit('close')">
    <header class="diag-head">
      <div>
        <h2 id="diag-modal-title" class="diag-title">排版检查与提示</h2>
        <p class="diag-subtitle">检查微信公众号兼容性、媒体占位与优化建议</p>
      </div>
      <button type="button" class="close-btn" aria-label="关闭" @click="emit('close')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="diag-filter-bar">
      <div class="diag-filters">
        <button
          v-for="key in (['all', 'error', 'warning', 'info'] as const)"
          :key="key"
          type="button"
          class="filter-btn"
          :class="{ active: filter === key }"
          @click="filter = key"
        >
          {{ key === 'all' ? '全部' : LABELS[key] }}
          <span class="count">{{ counts[key] }}</span>
        </button>
      </div>
    </div>

    <div class="diag-content">
      <p v-if="pending" class="diag-hint">正在重新转换，诊断结果计算中…</p>
      <div v-else-if="visible.length === 0" class="diag-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round" />
          <polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="empty-title">排版检查全部通过</p>
        <p class="empty-desc">没有发现格式问题，可以放心复制到微信公众号后台。</p>
      </div>

      <ul v-else class="diag-list">
        <li v-for="item in visible" :key="item.id" class="diag-item" :class="item.severity">
          <div class="diag-row">
            <span class="badge">{{ LABELS[item.severity] }}</span>
            <span class="item-title">{{ CODE_TITLES[item.code] || item.code }}</span>
            <span v-if="CODE_TITLES[item.code]" class="code-pill">{{ item.code }}</span>
            <button
              v-if="item.span"
              type="button"
              class="line-btn"
              title="点击在编辑器中定位"
              @click="handleJump(item.span.line)"
            >
              第 {{ item.span.line }} 行定位 →
            </button>
            <span v-if="item.review" class="review-tag">需确认</span>
          </div>
          <p class="message">{{ item.message }}</p>
          <div v-if="item.action" class="diag-detail-row action">
            <span class="tag">已处理</span>
            <span class="text">{{ item.action }}</span>
          </div>
          <div v-if="item.advice" class="diag-detail-row advice">
            <span class="tag">建议</span>
            <span class="text">{{ item.advice }}</span>
          </div>
        </li>
      </ul>
    </div>

    <footer class="modal-foot">
      <span class="foot-tip">点击行号按钮可直接跳转至左侧编辑器对应位置查看修改</span>
      <button type="button" class="done-btn" @click="emit('close')">关闭</button>
    </footer>
  </ModalShell>
</template>

<style scoped>
.diag-filter-bar {
  padding: 10px 22px;
  background: #f8fafc;
  border-bottom: 1px solid #eef1f6;
  display: flex;
  align-items: center;
  flex: none;
}
.diag-filters {
  display: flex;
  gap: 6px;
}
.filter-btn {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  font-size: 12px;
  font-family: inherit;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  gap: 5px;
  align-items: center;
  transition: all 0.15s ease;
}
.filter-btn:hover {
  border-color: #cbd5e1;
  color: #1e293b;
}
.filter-btn.active {
  background: #0f172a;
  border-color: #0f172a;
  color: #ffffff;
  font-weight: 500;
}
.count {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
.diag-content {
  flex: 1;
  min-height: 120px;
  max-height: 420px;
  overflow-y: auto;
  padding: 14px 22px;
}
.diag-hint {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}
.diag-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 20px;
  text-align: center;
}
.empty-title {
  margin: 12px 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}
.empty-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}
.diag-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.diag-item {
  padding: 10px 14px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #eef1f6;
  border-left-width: 4px;
}
.diag-item.error {
  border-left-color: #ef4444;
  background: #fffafa;
}
.diag-item.warning {
  border-left-color: #f59e0b;
  background: #fffdf7;
}
.diag-item.info {
  border-left-color: #3b82f6;
  background: #f8fbff;
}
.diag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.badge {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
}
.diag-item.error .badge {
  color: #dc2626;
}
.diag-item.warning .badge {
  color: #d97706;
}
.diag-item.info .badge {
  color: #2563eb;
}
.item-title {
  font-size: 12.5px;
  font-weight: 600;
  color: #0f172a;
}
.code-pill {
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 10.5px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
}
.line-btn {
  margin-left: auto;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11.5px;
  font-weight: 500;
  font-family: inherit;
  padding: 2px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.line-btn:hover {
  background: #dbeafe;
  border-color: #bfdbfe;
}
.review-tag {
  font-size: 11px;
  color: #7c3aed;
  background: #f3e8ff;
  border-radius: 999px;
  padding: 1px 7px;
}
.message {
  margin: 6px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: #334155;
}
.diag-detail-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.5;
}
.diag-detail-row .tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 0 5px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 1px;
}
.diag-detail-row.action .tag {
  color: #0369a1;
  background: #e0f2fe;
}
.diag-detail-row.action .text {
  color: #475569;
}
.diag-detail-row.advice .tag {
  color: #b45309;
  background: #fef3c7;
}
.diag-detail-row.advice .text {
  color: #92400e;
}
</style>
