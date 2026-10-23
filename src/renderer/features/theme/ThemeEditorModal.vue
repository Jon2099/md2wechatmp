<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ModalShell from '../../components/ModalShell.vue'
import type { ThemeProfile } from '@shared/models/theme'
import { cloneProfile, type EditorTab } from './editor/types'
import TabBasicColors from './editor/TabBasicColors.vue'
import TabTypography from './editor/TabTypography.vue'
import TabElements from './editor/TabElements.vue'
import ThemePreviewPanel from './editor/ThemePreviewPanel.vue'
import { saveCustomTheme, view } from '../../state/store'

const props = defineProps<{
  themeId: string | null
  baseThemeId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const activeTab = ref<EditorTab>('colors')
const draft = ref<ThemeProfile | null>(null)
const saving = ref(false)
const saveError = ref('')
let originalTheme: ThemeProfile | null = null

onMounted(async () => {
  const bridge = window.md2w
  if (!bridge) return
  const targetId = props.themeId || props.baseThemeId || 'ocean-blue'
  const res = await bridge.getTheme(targetId)
  if (res.ok) {
    originalTheme = cloneProfile(res.data)
    const cloned = cloneProfile(res.data)
    if (!props.themeId) {
      cloned.id = `custom-${Date.now()}`
      cloned.name = `${res.data.name} 自定义`
    }
    draft.value = cloned
  }
})

async function persist(profile: ThemeProfile): Promise<void> {
  if (saving.value) return
  saving.value = true
  saveError.value = ''
  try {
    if (!await saveCustomTheme(profile)) saveError.value = view.toast?.text || '保存主题失败，请重试。'
  } finally {
    saving.value = false
  }
}

async function onSave(): Promise<void> {
  if (draft.value) await persist(draft.value)
}

async function onSaveAsNew(): Promise<void> {
  if (!draft.value || saving.value) return
  const newProfile = cloneProfile(draft.value)
  newProfile.id = `custom-${Date.now()}`
  newProfile.name = `${draft.value.name} (副本)`
  await persist(newProfile)
}

function onReset(): void {
  if (originalTheme) draft.value = cloneProfile(originalTheme)
}
</script>

<template>
  <ModalShell labelledby="theme-editor-title" width="980px" @close="emit('close')">
    <div v-if="draft" class="editor-shell">
      <header class="editor-head">
        <div>
          <h2 id="theme-editor-title" class="editor-title">{{ themeId ? '编辑自定义主题' : '创建自定义主题' }}</h2>
          <p class="editor-subtitle">自由定制多维度配色、字体、字号、间距与组件样式，自动本地持久化保存</p>
        </div>
        <button type="button" class="close-btn" aria-label="关闭" @click="emit('close')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <div class="editor-body">
        <div class="editor-controls">
          <nav class="nav-tabs">
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'colors' }" @click="activeTab = 'colors'">基础与色彩</button>
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'typography' }" @click="activeTab = 'typography'">字体与段落</button>
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'elements' }" @click="activeTab = 'elements'">标题与组件</button>
          </nav>

          <div class="tab-content">
            <TabBasicColors v-if="activeTab === 'colors'" :draft="draft" />
            <TabTypography v-else-if="activeTab === 'typography'" :draft="draft" />
            <TabElements v-else-if="activeTab === 'elements'" :draft="draft" />
          </div>
        </div>

        <div class="editor-preview-side">
          <ThemePreviewPanel :draft="draft" />
        </div>
      </div>

      <p v-if="saveError" class="save-error" role="alert">{{ saveError }}</p>
      <footer class="editor-footer">
        <div class="footer-left">
          <button type="button" class="btn" @click="onReset">恢复初始预设</button>
          <button v-if="themeId" type="button" class="btn" :disabled="saving" @click="onSaveAsNew">另存为新主题</button>
        </div>
        <div class="footer-right">
          <button type="button" class="btn" @click="emit('close')">取消</button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="onSave">{{ saving ? '正在保存…' : '保存并设为当前主题' }}</button>
        </div>
      </footer>
    </div>
  </ModalShell>
</template>

<style scoped src="./ThemeEditorModal.css"></style>
