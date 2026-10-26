<script setup lang="ts">
import type { ThemeProfile } from '@shared/models/theme'
import { BODY_TEXT_COLOR } from '@shared/models/theme'

const props = defineProps<{
  draft: ThemeProfile
}>()
</script>

<template>
  <div class="tab-panel">
    <section class="form-group">
      <h3 class="section-title">基础信息</h3>
      <div class="row">
        <label class="field flex-1">
          <span class="label-text">主题名称</span>
          <input v-model="draft.name" type="text" class="text-input" placeholder="例如：极客青蓝" maxlength="24" />
        </label>
        <label class="field flex-2">
          <span class="label-text">主题描述</span>
          <input v-model="draft.description" type="text" class="text-input" placeholder="例如：适合技术干货与深度长文" maxlength="60" />
        </label>
      </div>
    </section>

    <section class="form-group">
      <h3 class="section-title">核心色彩</h3>
      <p class="color-hint">品牌主色用于提示块的强调线；标题、引用和链接保留各自的独立配色。</p>
      <div class="color-grid">
        <div class="color-item">
          <span class="color-label">品牌主色 (Accent)</span>
          <div class="color-picker-row">
            <input v-model="draft.colors.accent" type="color" class="color-input" />
            <input v-model="draft.colors.accent" type="text" class="hex-input" />
          </div>
        </div>

        <div class="color-item">
          <span class="color-label">正文文字（所有主题固定）</span>
          <div class="color-picker-row">
            <input :value="BODY_TEXT_COLOR" type="color" class="color-input" aria-label="固定正文颜色" disabled />
            <input :value="BODY_TEXT_COLOR" type="text" class="hex-input" aria-label="正文颜色值" readonly />
          </div>
        </div>

        <div class="color-item">
          <span class="color-label">标题文字 (Heading)</span>
          <div class="color-picker-row">
            <input v-model="draft.colors.heading" type="color" class="color-input" />
            <input v-model="draft.colors.heading" type="text" class="hex-input" />
          </div>
        </div>

        <div class="color-item">
          <span class="color-label">加粗高亮 (Strong)</span>
          <div class="color-picker-row">
            <input v-model="draft.colors.strong" type="color" class="color-input" />
            <input v-model="draft.colors.strong" type="text" class="hex-input" />
          </div>
        </div>

        <div class="color-item">
          <span class="color-label">链接文字 (Link)</span>
          <div class="color-picker-row">
            <input v-model="draft.colors.link" type="color" class="color-input" />
            <input v-model="draft.colors.link" type="text" class="hex-input" />
          </div>
        </div>

        <div class="color-item">
          <span class="color-label">次要文字 (Secondary)</span>
          <div class="color-picker-row">
            <input v-model="draft.colors.textSecondary" type="color" class="color-input" />
            <input v-model="draft.colors.textSecondary" type="text" class="hex-input" />
          </div>
        </div>

        <div class="color-item">
          <span class="color-label">页面底色 (Background)</span>
          <div class="color-picker-row">
            <input v-model="draft.colors.background" type="color" class="color-input" />
            <input v-model="draft.colors.background" type="text" class="hex-input" />
          </div>
        </div>

        <div class="color-item">
          <span class="color-label">边框底线 (Border)</span>
          <div class="color-picker-row">
            <input v-model="draft.colors.border" type="color" class="color-input" />
            <input v-model="draft.colors.border" type="text" class="hex-input" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped src="./editor-tabs.css"></style>

<style scoped>
.color-hint { margin: -4px 0 16px; color: #64748b; font-size: 12px; line-height: 1.6; }
</style>
