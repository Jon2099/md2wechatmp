<script setup lang="ts">
import type { ThemeId, ThemeSummary } from '@shared/models/theme'

defineProps<{ themes: ThemeSummary[]; active: ThemeId }>()
const emit = defineEmits<{ select: [ThemeId] }>()
</script>

<template>
  <div class="theme-picker">
    <button
      v-for="theme in themes"
      :key="theme.id"
      type="button"
      class="theme-chip"
      :class="{ active: theme.id === active }"
      :title="theme.description"
      @click="emit('select', theme.id)"
    >
      <span class="theme-dot" :style="{ backgroundColor: theme.accent }" />
      <span class="theme-name">{{ theme.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.theme-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.theme-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
  font-family: inherit;
  padding: 5px 11px;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.theme-chip:hover {
  border-color: #c7d2e4;
  color: #1f2937;
}
.theme-chip.active {
  border-color: #1d4ed8;
  color: #1d4ed8;
  background: #eff4ff;
  font-weight: 600;
}
.theme-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}
</style>
