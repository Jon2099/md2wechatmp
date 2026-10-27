<script setup lang="ts">
import type { ThemeProfile } from '@shared/models/theme'

const props = defineProps<{
  draft: ThemeProfile
}>()
</script>

<template>
  <div class="tab-panel">
    <section class="form-group">
      <h3 class="section-title">字号与段落排版 (Typography & Spacing)</h3>
      <div class="sliders-grid">
        <div class="slider-item">
          <div class="slider-header">
            <span>正文字号</span>
            <span class="slider-val">{{ draft.sizes.body }} px</span>
          </div>
          <input v-model.number="draft.sizes.body" type="range" min="14" max="18" step="0.5" class="range-input" />
        </div>

        <div class="slider-item">
          <div class="slider-header">
            <span>正文行高 (Line Height)</span>
            <span class="slider-val">{{ draft.paragraph.lineHeight }}x</span>
          </div>
          <input v-model.number="draft.paragraph.lineHeight" type="range" min="1.5" max="2.4" step="0.05" class="range-input" />
        </div>

        <div class="slider-item">
          <div class="slider-header">
            <span>正文字间距 (Letter Spacing)</span>
            <span class="slider-val">{{ draft.paragraph.letterSpacing }} px</span>
          </div>
          <input v-model.number="draft.paragraph.letterSpacing" type="range" min="0" max="3" step="0.25" class="range-input" />
        </div>

        <div class="slider-item">
          <div class="slider-header">
            <span>段落上下间距 (Paragraph Gap)</span>
            <span class="slider-val">{{ draft.paragraph.gap }} px</span>
          </div>
          <input v-model.number="draft.paragraph.gap" type="range" min="8" max="24" step="1" class="range-input" />
        </div>
      </div>

      <div class="row pt-2">
        <label class="field flex-1">
          <span class="label-text">段落对齐方式</span>
          <select v-model="draft.paragraph.align" class="select-input">
            <option value="justify">两端对齐 (两边对齐排版推荐)</option>
            <option value="left">居左对齐 (传统左对齐)</option>
          </select>
        </label>

        <label class="field flex-1">
          <span class="label-text">首行缩进</span>
          <select v-model.number="draft.paragraph.firstLineIndentPx" class="select-input">
            <option :value="0">无缩进 (现代新媒体排版)</option>
            <option :value="32">缩进两字符 (传统文章风格)</option>
          </select>
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped src="./editor-tabs.css"></style>
