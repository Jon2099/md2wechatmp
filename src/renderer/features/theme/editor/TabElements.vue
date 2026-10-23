<script setup lang="ts">
import { computed } from 'vue'
import type { ThemeProfile } from '@shared/models/theme'

const props = defineProps<{
  draft: ThemeProfile
}>()

const zebra = computed({
  get: () => props.draft.table.zebra,
  set: (enabled: boolean) => {
    props.draft.table.zebra = enabled
    // Some monochrome presets have no stripe color until explicitly enabled.
    if (enabled && !props.draft.colors.zebra) props.draft.colors.zebra = props.draft.colors.surface
  },
})
</script>

<template>
  <div class="tab-panel">
    <section class="form-group">
      <h3 class="section-title">标题系统 (Headings)</h3>
      <div class="row">
        <label class="field flex-1">
          <span class="label-text">标题编号风格</span>
          <select v-model="draft.headings.numbering" class="select-input">
            <option value="none">无自动编号</option>
            <option value="h2-two-digit">二级标题阿拉伯双数 (01 / 02)</option>
            <option value="h2-cn">二级标题中文小节 (一、 / 二、)</option>
          </select>
        </label>
        <label class="field flex-1">
          <span class="label-text">一级大标题对齐</span>
          <select v-model="draft.headings.levels[0].align" class="select-input">
            <option value="left">居左对齐</option>
            <option value="center">居中对称</option>
          </select>
        </label>
      </div>

      <div class="sliders-grid">
        <div class="slider-item">
          <div class="slider-header">
            <span>H1 一级标题字号</span>
            <span class="slider-val">{{ draft.headings.levels[0].size }} px</span>
          </div>
          <input v-model.number="draft.headings.levels[0].size" type="range" min="18" max="28" step="1" class="range-input" />
        </div>
        <div class="slider-item">
          <div class="slider-header">
            <span>H2 二级标题字号</span>
            <span class="slider-val">{{ draft.headings.levels[1].size }} px</span>
          </div>
          <input v-model.number="draft.headings.levels[1].size" type="range" min="16" max="24" step="1" class="range-input" />
        </div>
      </div>
    </section>

    <section class="form-group">
      <h3 class="section-title">引用与代码块 (Quote & Code)</h3>
      <div class="row">
        <label class="field flex-1">
          <span class="label-text">引用块形态 (Blockquote)</span>
          <select v-model="draft.quote.shape" class="select-input">
            <option value="bar">左侧强调色条 (经典条形)</option>
            <option value="panel">浅色温润卡片 (轻面板形)</option>
          </select>
        </label>
        <label class="field flex-1">
          <span class="label-text">引用块圆角</span>
          <select v-model.number="draft.quote.radius" class="select-input">
            <option :value="0">直角 (0px)</option>
            <option :value="4">微圆角 (4px)</option>
            <option :value="8">平滑圆角 (8px)</option>
          </select>
        </label>
      </div>
      <div class="row">
        <label class="field flex-1">
          <span class="label-text">代码块圆角</span>
          <select v-model.number="draft.code.blockRadius" class="select-input">
            <option :value="0">直角 (0px)</option>
            <option :value="4">微圆角 (4px)</option>
            <option :value="8">现代大圆角 (8px)</option>
          </select>
        </label>
        <div class="color-item flex-1">
          <span class="color-label">代码块背景底色</span>
          <div class="color-picker-row">
            <input v-model="draft.code.blockBg" type="color" class="color-input" />
            <input v-model="draft.code.blockBg" type="text" class="hex-input" />
          </div>
        </div>
      </div>
    </section>

    <section class="form-group">
      <h3 class="section-title">表格与分割线 (Table & Divider)</h3>
      <div class="row">
        <label class="field flex-1">
          <span class="label-text">表格斑马纹</span>
          <select v-model="zebra" class="select-input">
            <option :value="true">开启隔行斑马纹</option>
            <option :value="false">关闭斑马纹 (纯白简洁)</option>
          </select>
        </label>
        <label class="field flex-1">
          <span class="label-text">分割线形态</span>
          <select v-model="draft.divider.form" class="select-input">
            <option value="line">实线 (Solid Line)</option>
            <option value="dashed">虚线 (Dashed)</option>
            <option value="dotted">圆点线 (Dotted)</option>
            <option value="block">居中色块 (Mini Block)</option>
          </select>
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped src="./editor-tabs.css"></style>
