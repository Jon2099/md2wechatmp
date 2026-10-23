<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppTitleBar from './components/AppTitleBar.vue'
import StatusBar from './components/StatusBar.vue'
import MarkdownEditor from './features/editor/MarkdownEditor.vue'
import PreviewPane from './features/preview/PreviewPane.vue'
import ThemeModal from './features/theme/ThemeModal.vue'
import DiagnosticsPanel from './features/diagnostics/DiagnosticsPanel.vue'
import SettingsPanel from './features/settings/SettingsPanel.vue'
import HelpModal from './features/help/HelpModal.vue'
import AboutModal from './features/about/AboutModal.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import {
  acceptRecovery,
  canCopy,
  compileNow,
  copyToWechat,
  diagnostics,
  diagnosticsSummary,
  dirty,
  discardRecovery,
  dismissToast,
  dispose,
  exportHtml,
  ignoreExternalConflict,
  init,
  newDocument,
  onTextChange,
  openFile,
  reloadExternal,
  save,
  setDismissHelpOnStartup,
  setPreviewWidth,
  setTheme,
  snapshotFresh,
  statusText,
  toggleAboutModal,
  toggleDiagnostics,
  toggleHelpModal,
  toggleSettings,
  toggleThemeModal,
  view,
} from './state/store'
import type { PreviewWidth } from '@shared/models/compile'
import type { ThemeId } from '@shared/models/theme'

const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

const activeAccent = computed(() => {
  const theme = view.themes.find((item) => item.id === view.themeId)
  return theme?.accent ?? '#1d4ed8'
})

const currentThemeName = computed(() => {
  const theme = view.themes.find((item) => item.id === view.themeId)
  return theme?.name ?? '深海蓝'
})

const stats = computed(() => view.snapshot?.stats ?? null)

function jumpToLine(line: number): void {
  editorRef.value?.revealLine(line)
}

function onKeydown(event: KeyboardEvent): void {
  if (view.busy || view.confirmation) return
  const meta = event.metaKey || event.ctrlKey

  if (event.key === 'F1') {
    event.preventDefault()
    toggleHelpModal()
    return
  }

  if (event.key === 'Escape') {
    if (view.showHelpModal) {
      toggleHelpModal(false)
      return
    }
    if (view.showAboutModal) {
      toggleAboutModal(false)
      return
    }
    if (view.showThemeModal) {
      toggleThemeModal(false)
      return
    }
    if (view.showSettings) {
      toggleSettings(false)
      return
    }
    if (view.showDiagnostics) {
      toggleDiagnostics(false)
      return
    }
  }

  if (!meta) return
  const key = event.key.toLowerCase()

  if (key === 's') {
    event.preventDefault()
    void (event.shiftKey ? save(true) : save(false))
    return
  }
  if (key === 'o') {
    event.preventDefault()
    void openFile()
    return
  }
  if (key === 'n') {
    event.preventDefault()
    void newDocument()
    return
  }
  if (key === 'enter') {
    event.preventDefault()
    void compileNow()
    return
  }
  if (key === 'c' && event.shiftKey) {
    event.preventDefault()
    void copyToWechat()
    return
  }
  if (key === 'e' && event.shiftKey) {
    event.preventDefault()
    void exportHtml(true)
    return
  }
  if (key === 't' && event.shiftKey) {
    event.preventDefault()
    toggleThemeModal()
    return
  }
  if (key === 'd' && event.shiftKey) {
    event.preventDefault()
    toggleDiagnostics()
    return
  }
  if (event.key === ',') {
    event.preventDefault()
    toggleSettings()
    return
  }
}

watch(
  [() => view.fileName, () => dirty.value],
  ([name, isDirty]) => {
    document.title = `${isDirty ? '● ' : ''}${name || '未命名.md'} - 排版助手`
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void init()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  dispose()
})
</script>

<template>
  <div class="app" :inert="view.busy">
    <!-- 顶部现代化自定义标题栏与菜单 -->
    <AppTitleBar
      :file-name="view.fileName"
      :path-label="view.pathLabel"
      :dirty="dirty"
      :themes="view.themes"
      :active-theme-id="view.themeId"
      :preview-width="view.previewWidth"
      @new="newDocument()"
      @open="openFile()"
      @save="save(false)"
      @save-as="save(true)"
      @export="exportHtml(true)"
      @recompile="compileNow()"
      @copy="copyToWechat()"
      @select-theme="(id: ThemeId) => setTheme(id)"
      @open-theme-modal="toggleThemeModal(true)"
      @open-settings="toggleSettings(true)"
      @open-diagnostics="toggleDiagnostics(true)"
      @open-help="toggleHelpModal(true)"
      @open-about="toggleAboutModal(true)"
      @select-preview-width="(width: PreviewWidth) => setPreviewWidth(width)"
    />

    <!-- 未保存副本恢复浮条 -->
    <div v-if="view.recovery" class="recovery-banner">
      <span class="recovery-text">
        发现未保存的工作副本：{{ view.recovery.fileName }}（{{
          new Date(view.recovery.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }}）
      </span>
      <div class="recovery-actions">
        <button type="button" class="recovery-btn" @click="acceptRecovery()">恢复副本</button>
        <button type="button" class="recovery-ghost" @click="discardRecovery()">忽略</button>
      </div>
    </div>

    <!-- 外部写入冲突提示浮条 -->
    <div v-if="view.externalConflict" class="recovery-banner">
      <span class="recovery-text">
        文件已在磁盘被外部（如 AI）修改，当前有未保存的本地改动。
      </span>
      <div class="recovery-actions">
        <button type="button" class="recovery-btn" @click="reloadExternal()">载入磁盘最新内容</button>
        <button type="button" class="recovery-ghost" @click="ignoreExternalConflict()">保留本地编辑</button>
      </div>
    </div>

    <!-- 主工作区：左侧 2/3 源文编辑，右侧 1/3 微信预览 -->
    <main class="workspace">
      <section class="editor-col">
        <header class="col-head">
          <span class="col-title">Markdown 源文</span>
          <span class="col-shortcut">Ctrl + Enter 立即转换</span>
        </header>

        <div class="editor-wrap">
          <MarkdownEditor
            :key="view.docId ?? 'initial'"
            ref="editorRef"
            :model-value="view.text"
            @update:model-value="onTextChange"
          />
        </div>
      </section>

      <section class="preview-col">
        <PreviewPane
          :snapshot="view.snapshot"
          :accent="activeAccent"
          :width="view.previewWidth"
          :pending="view.pending"
          :stale="!snapshotFresh"
          @update:width="(width: PreviewWidth) => setPreviewWidth(width)"
        />
      </section>
    </main>

    <!-- 底部状态单行栏：点击弹出详情 -->
    <StatusBar
      :status="statusText"
      :stats="stats"
      :counts="diagnosticsSummary"
      :diagnostics-open="view.showDiagnostics"
      :theme-name="currentThemeName"
      :theme-accent="activeAccent"
      :can-copy="canCopy"
      :copy-state="view.copyState"
      @toggle-diagnostics="toggleDiagnostics()"
      @open-theme="toggleThemeModal(true)"
      @copy="copyToWechat()"
    />

    <!-- 弹窗：主题选择 -->
    <ThemeModal
      v-if="view.showThemeModal"
      :themes="view.themes"
      :active="view.themeId"
      @select="(id: ThemeId) => setTheme(id)"
      @close="toggleThemeModal(false)"
    />

    <!-- 弹窗：选项设置 -->
    <SettingsPanel v-if="view.showSettings" />

    <!-- 弹窗：诊断详情 -->
    <DiagnosticsPanel
      v-if="view.showDiagnostics"
      :items="diagnostics"
      :pending="view.pending"
      @jump="jumpToLine"
      @close="toggleDiagnostics(false)"
    />

    <!-- 弹窗：使用说明与帮助 -->
    <HelpModal
      v-if="view.showHelpModal"
      :dismiss-on-startup="view.dismissHelpOnStartup"
      @update:dismiss-on-startup="(val) => setDismissHelpOnStartup(val)"
      @close="toggleHelpModal(false)"
    />

    <!-- 弹窗：关于 -->
    <AboutModal
      v-if="view.showAboutModal"
      @close="toggleAboutModal(false)"
    />

    <!-- 全局轻提示 -->
    <Transition name="toast">
      <div
        v-if="view.toast"
        :key="view.toast.id"
        class="toast"
        :class="view.toast.tone"
        role="status"
        @click="dismissToast()"
      >
        {{ view.toast.text }}
      </div>
    </Transition>
  </div>
  <ConfirmDialog />
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: #ffffff;
  overflow: hidden;
}

.recovery-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  font-size: 12px;
  color: #92400e;
  flex: none;
  z-index: 20;
}
.recovery-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.recovery-btn {
  border: 1px solid #d97706;
  background: #ffffff;
  color: #b45309;
  font-size: 11.5px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 5px;
  cursor: pointer;
}
.recovery-ghost {
  border: none;
  background: transparent;
  color: #a16207;
  font-size: 11.5px;
  cursor: pointer;
}

.workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  background: #ffffff;
}

/* 左侧 Markdown 占 2/3 */
.editor-col {
  flex: 2 1 0%;
  width: 66.666%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid #eef1f6;
}

/* 右侧微信预览 占 1/3 */
.preview-col {
  flex: 1 1 0%;
  width: 33.333%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f1f4f9;
}

.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  min-height: 32px;
  padding: 0 14px;
  background: #f8fafc;
  border-bottom: 1px solid #eef1f6;
  flex: none;
}
.col-title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.01em;
}
.col-shortcut {
  font-size: 11px;
  color: #94a3b8;
  font-family: inherit;
}

.editor-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 42px;
  transform: translateX(-50%);
  max-width: 70vw;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  background: #0f172a;
  color: #f8fafc;
  z-index: 120;
}
.toast.ok {
  background: #0d7a68;
}
.toast.warn {
  background: #b45309;
}
.toast.error {
  background: #b91c1c;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}
</style>
