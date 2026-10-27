<script setup lang="ts">
import ModalShell from '../../components/ModalShell.vue'
import type { ThemeId, ThemeSummary } from '@shared/models/theme'

const props = defineProps<{
  themes: ThemeSummary[]
  active: ThemeId
}>()

const emit = defineEmits<{
  select: [ThemeId]
  close: []
  create: [baseThemeId?: string]
  edit: [id: string]
  delete: [id: string]
}>()

const THEME_TAGS: Record<ThemeId, { tag: string; sample: string }> = {
  'ocean-blue': { tag: '技术 / 商业 / 深度', sample: '经典深蓝 · 沉稳规范' },
  graphite: { tag: '极简 / 开发者 / 日志', sample: '纯黑白灰 · 极简无噪' },
  terracotta: { tag: '随笔 / 读书笔记', sample: '暖陶温润 · 虚线雅致' },
  jade: { tag: '教程 / 指南 / 产品', sample: '清新青绿 · 圆角通透' },
  magazine: { tag: '深度特稿 / 文化评论', sample: '衬线排版 · 报刊质感' },
  amber: { tag: '复盘经验 / 思考干货', sample: '明媚暖金 · 舒适耐读' },
  violet: { tag: '情感心理 / 艺术美学', sample: '静谧暮紫 · 高雅内敛' },
  ink: { tag: '文学历史 / 诗词散文', sample: '水墨宣纸 · 朱砂沉静' },
}
</script>

<template>
  <ModalShell labelledby="theme-modal-title" width="820px" @close="emit('close')">
    <header class="modal-head">
      <div>
        <h2 id="theme-modal-title" class="modal-title">排版主题</h2>
        <p class="modal-subtitle">切换文章配色与排版风格，正文内容与结构自动保留</p>
      </div>
      <div class="head-actions">
        <button type="button" class="btn-create-theme" @click="emit('create')">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          新建自定义主题
        </button>
        <button type="button" class="close-btn" aria-label="关闭" @click="emit('close')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </header>

    <div class="theme-grid">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        class="theme-card"
        :class="{ active: theme.id === active }"
        @click="emit('select', theme.id)"
      >
        <div class="theme-card-head">
          <div class="theme-swatch" :style="{ backgroundColor: theme.accent }">
            <svg v-if="theme.id === active" width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="theme-meta">
            <span class="theme-name">{{ theme.name }}</span>
            <span v-if="theme.isCustom" class="theme-tag custom-tag">自定义</span>
            <span v-else-if="THEME_TAGS[theme.id]" class="theme-tag">{{ THEME_TAGS[theme.id].tag }}</span>
          </div>
          <div class="card-badges">
            <span v-if="theme.id === active" class="current-badge">当前使用</span>
            <div v-if="theme.isCustom" class="custom-actions">
              <span class="action-link" title="编辑主题" @click.stop="emit('edit', theme.id)">编辑</span>
              <span class="action-link text-danger" title="删除主题" @click.stop="emit('delete', theme.id)">删除</span>
            </div>
            <span v-else class="action-link copy-link" title="基于此主题复制创建" @click.stop="emit('create', theme.id)">复制自定义</span>
          </div>
        </div>

        <p class="theme-desc">{{ theme.description }}</p>

        <div class="theme-preview-strip">
          <div class="sample-box" :style="{ borderLeftColor: theme.accent }">
            <span class="sample-label" :style="{ color: theme.accent }">排版</span>
            <span class="sample-text">{{ THEME_TAGS[theme.id]?.sample || '舒适排版' }}</span>
          </div>
          <span class="color-swatch-dot" :style="{ backgroundColor: theme.accent }" title="主题主色" />
        </div>
      </button>
    </div>

    <footer class="modal-foot">
      <span class="foot-tip">提示：点击卡片即刻生效并在右侧同步预览；底部状态栏也可快速切换</span>
      <button type="button" class="done-btn" @click="emit('close')">完成</button>
    </footer>
  </ModalShell>
</template>

<style scoped>
.theme-grid {
  padding: 16px 24px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 540px;
  overflow-y: auto;
}
.theme-card {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 11px;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: all 0.16s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.theme-card:hover {
  border-color: #94a3b8;
  background: #f8fafc;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  transform: translateY(-1px);
}
.theme-card.active {
  border-color: #2563eb;
  background: #f0f7ff;
  box-shadow: 0 0 0 2px #3b82f633, 0 4px 14px rgba(37, 99, 235, 0.1);
}
.theme-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.theme-swatch {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.theme-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.theme-name {
  font-size: 14px;
  font-weight: 650;
  color: #0f172a;
}
.theme-tag {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.current-badge {
  font-size: 11px;
  color: #1d4ed8;
  background: #dbeafe;
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 600;
  flex: none;
}
.theme-desc {
  margin: 5px 0 7px;
  font-size: 11.5px;
  color: #475569;
  line-height: 1.45;
}
.theme-preview-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background: #f8fafc;
  border: 1px solid #eef2f6;
  border-radius: 6px;
}
.theme-card.active .theme-preview-strip {
  background: #ffffff;
  border-color: #dbeafe;
}
.sample-box {
  display: flex;
  align-items: center;
  gap: 7px;
  border-left: 3px solid;
  padding-left: 7px;
  min-width: 0;
}
.sample-label {
  font-size: 10.5px;
  font-weight: 700;
  flex: none;
}
.sample-text {
  font-size: 11px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.color-swatch-dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  flex: none;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-create-theme {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #07c160;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-create-theme:hover {
  background: #06ad56;
}
.custom-tag {
  color: #07c160 !important;
  font-weight: 600;
}
.card-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.custom-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.action-link {
  font-size: 11px;
  color: #64748b;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  cursor: pointer;
}
.action-link:hover {
  color: #0f172a;
  background: #e2e8f0;
}
.copy-link:hover {
  color: #07c160;
  background: #ecfdf5;
}
.text-danger:hover {
  color: #dc2626;
  background: #fef2f2;
}
@media (max-width: 680px) {
  .theme-grid {
    grid-template-columns: 1fr;
  }
}
</style>
