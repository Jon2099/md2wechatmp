<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppLogo from './AppLogo.vue'
import type { PreviewWidth } from '@shared/models/compile'
import type { ThemeId, ThemeSummary } from '@shared/models/theme'

const props = defineProps<{
  fileName: string
  pathLabel: string
  dirty: boolean
  themes: ThemeSummary[]
  activeThemeId: ThemeId
  previewWidth: PreviewWidth
  autoSaveInterval?: number
}>()

const emit = defineEmits<{
  new: []
  open: []
  save: []
  saveAs: []
  toggleAutoSave: []
  export: []
  recompile: []
  copy: []
  selectTheme: [ThemeId]
  openThemeModal: []
  openThemeEditor: []
  openSettings: []
  openDiagnostics: []
  openHelp: []
  openAbout: []
  selectPreviewWidth: [PreviewWidth]
}>()

const activeMenu = ref<string | null>(null)
const isMaximized = ref(false)

function toggleMenu(menuKey: string) {
  activeMenu.value = activeMenu.value === menuKey ? null : menuKey
}

function onMenuHover(menuKey: string) {
  if (activeMenu.value !== null) {
    activeMenu.value = menuKey
  }
}

function closeMenu() {
  activeMenu.value = null
}

function runAction(action: () => void) {
  closeMenu()
  action()
}

// 窗口控制
async function handleMinimize() {
  const bridge = window.md2w
  if (bridge?.minimizeWindow) await bridge.minimizeWindow()
}

async function handleMaximize() {
  const bridge = window.md2w
  if (bridge?.maximizeWindow) {
    const max = await bridge.maximizeWindow()
    isMaximized.value = max
  }
}

async function handleClose() {
  const bridge = window.md2w
  if (bridge?.closeWindow) await bridge.closeWindow()
}

function onWindowClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.menu-item')) {
    closeMenu()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeMenu.value !== null) {
    closeMenu()
  }
}

let unsubMaximized: (() => void) | null = null

onMounted(async () => {
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onKeydown)

  const bridge = window.md2w
  if (bridge?.isWindowMaximized) {
    isMaximized.value = await bridge.isWindowMaximized()
  }
  if (bridge?.onMaximizedChange) {
    unsubMaximized = bridge.onMaximizedChange((max) => {
      isMaximized.value = max
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onKeydown)
  if (unsubMaximized) unsubMaximized()
})
</script>

<template>
  <header class="titlebar" @dblclick="handleMaximize">
    <!-- 左侧：品牌图标与集成菜单栏 -->
    <div class="left-section">
      <div class="brand">
        <AppLogo :size="18" />
        <span class="app-title">排版助手</span>
      </div>

      <nav class="menubar">
        <!-- 文件菜单 -->
        <div class="menu-item" :class="{ open: activeMenu === 'file' }">
          <button
            type="button"
            class="menu-btn"
            @click.stop="toggleMenu('file')"
            @mouseenter="onMenuHover('file')"
          >
            文件
          </button>
          <div v-if="activeMenu === 'file'" class="dropdown">
            <button type="button" class="dropdown-item" @click="runAction(() => emit('new'))">
              <span>新建文档</span>
              <span class="shortcut">Ctrl+N</span>
            </button>
            <button type="button" class="dropdown-item" @click="runAction(() => emit('open'))">
              <span>打开文件...</span>
              <span class="shortcut">Ctrl+O</span>
            </button>
            <div class="divider" />
            <button type="button" class="dropdown-item" @click="runAction(() => emit('save'))">
              <span>保存文档</span>
              <span class="shortcut">Ctrl+S</span>
            </button>
            <button type="button" class="dropdown-item" @click="runAction(() => emit('saveAs'))">
              <span>另存为...</span>
              <span class="shortcut">Ctrl+Shift+S</span>
            </button>
            <button
              type="button"
              class="dropdown-item checkable"
              :class="{ checked: (autoSaveInterval ?? 0) > 0 }"
              @click="runAction(() => emit('toggleAutoSave'))"
            >
              <span>自动保存</span>
              <span v-if="(autoSaveInterval ?? 0) > 0" class="check">✓</span>
            </button>
            <div class="divider" />
            <button type="button" class="dropdown-item" @click="runAction(() => emit('export'))">
              <span>导出 HTML...</span>
              <span class="shortcut">Ctrl+Shift+E</span>
            </button>
            <div class="divider" />
            <button type="button" class="dropdown-item" @click="runAction(handleClose)">
              <span>退出</span>
              <span class="shortcut">Alt+F4</span>
            </button>
          </div>
        </div>

        <!-- 编辑菜单 -->
        <div class="menu-item" :class="{ open: activeMenu === 'edit' }">
          <button
            type="button"
            class="menu-btn"
            @click.stop="toggleMenu('edit')"
            @mouseenter="onMenuHover('edit')"
          >
            编辑
          </button>
          <div v-if="activeMenu === 'edit'" class="dropdown">
            <button type="button" class="dropdown-item" @click="runAction(() => emit('recompile'))">
              <span>重新转换</span>
              <span class="shortcut">Ctrl+Enter</span>
            </button>
            <button type="button" class="dropdown-item" @click="runAction(() => emit('copy'))">
              <span>复制到微信</span>
              <span class="shortcut">Ctrl+Shift+C</span>
            </button>
          </div>
        </div>

        <!-- 视图菜单 -->
        <div class="menu-item" :class="{ open: activeMenu === 'view' }">
          <button
            type="button"
            class="menu-btn"
            @click.stop="toggleMenu('view')"
            @mouseenter="onMenuHover('view')"
          >
            视图
          </button>
          <div v-if="activeMenu === 'view'" class="dropdown">
            <div class="dropdown-label">微信预览宽度</div>
            <button
              type="button"
              class="dropdown-item checkable"
              :class="{ checked: previewWidth === 320 }"
              @click="runAction(() => emit('selectPreviewWidth', 320))"
            >
              <span>小屏 (320px)</span>
              <span v-if="previewWidth === 320" class="check">✓</span>
            </button>
            <button
              type="button"
              class="dropdown-item checkable"
              :class="{ checked: previewWidth === 375 }"
              @click="runAction(() => emit('selectPreviewWidth', 375))"
            >
              <span>标准 (375px)</span>
              <span v-if="previewWidth === 375" class="check">✓</span>
            </button>
            <button
              type="button"
              class="dropdown-item checkable"
              :class="{ checked: previewWidth === 430 }"
              @click="runAction(() => emit('selectPreviewWidth', 430))"
            >
              <span>大屏 (430px)</span>
              <span v-if="previewWidth === 430" class="check">✓</span>
            </button>
          </div>
        </div>

        <!-- 主题菜单 -->
        <div class="menu-item" :class="{ open: activeMenu === 'theme' }">
          <button
            type="button"
            class="menu-btn"
            @click.stop="toggleMenu('theme')"
            @mouseenter="onMenuHover('theme')"
          >
            主题
          </button>
          <div v-if="activeMenu === 'theme'" class="dropdown">
            <button type="button" class="dropdown-item" @click="runAction(() => emit('openThemeModal'))">
              <span>选择排版主题...</span>
              <span class="shortcut">Ctrl+Shift+T</span>
            </button>
            <button type="button" class="dropdown-item" @click="runAction(() => emit('openThemeEditor'))">
              <span>新建自定义主题...</span>
            </button>
            <div class="divider" />
            <div class="dropdown-label">快速切换主题</div>
            <button
              v-for="t in themes"
              :key="t.id"
              type="button"
              class="dropdown-item checkable"
              :class="{ checked: t.id === activeThemeId }"
              @click="runAction(() => emit('selectTheme', t.id))"
            >
              <div class="theme-entry">
                <span class="theme-dot" :style="{ backgroundColor: t.accent }" />
                <span>{{ t.name }}</span>
                <span v-if="t.isCustom" class="custom-pill">自</span>
              </div>
              <span v-if="t.id === activeThemeId" class="check">✓</span>
            </button>
          </div>
        </div>

        <!-- 选项菜单 -->
        <div class="menu-item" :class="{ open: activeMenu === 'options' }">
          <button
            type="button"
            class="menu-btn"
            @click.stop="toggleMenu('options')"
            @mouseenter="onMenuHover('options')"
          >
            选项
          </button>
          <div v-if="activeMenu === 'options'" class="dropdown">
            <button type="button" class="dropdown-item" @click="runAction(() => emit('openSettings'))">
              <span>排版输出设置...</span>
              <span class="shortcut">Ctrl+,</span>
            </button>
            <button type="button" class="dropdown-item" @click="runAction(() => emit('openDiagnostics'))">
              <span>排版检查与诊断...</span>
              <span class="shortcut">Ctrl+Shift+D</span>
            </button>
          </div>
        </div>

        <!-- 帮助菜单：作为单独选项，放在选项右侧 -->
        <div class="menu-item" :class="{ open: activeMenu === 'help' }">
          <button
            type="button"
            class="menu-btn"
            @click.stop="toggleMenu('help')"
            @mouseenter="onMenuHover('help')"
          >
            帮助
          </button>
          <div v-if="activeMenu === 'help'" class="dropdown">
            <button type="button" class="dropdown-item" @click="runAction(() => emit('openHelp'))">
              <span>使用说明与技巧...</span>
              <span class="shortcut">F1</span>
            </button>
          </div>
        </div>

        <!-- 关于菜单：一级菜单，放在帮助右侧，点击直接弹窗 -->
        <div class="menu-item">
          <button
            type="button"
            class="menu-btn"
            @click.stop="runAction(() => emit('openAbout'))"
            @mouseenter="closeMenu()"
          >
            关于
          </button>
        </div>
      </nav>
    </div>

    <!-- 中间：当前文件名与拖拽区 -->
    <div class="center-section" :title="pathLabel">
      <div class="file-badge">
        <span class="dot" :class="{ dirty }" />
        <span class="file-title">{{ fileName }}</span>
        <span v-if="dirty" class="dirty-badge">已修改</span>
      </div>
    </div>

    <!-- 右侧：窗口控制按钮 -->
    <div class="right-section">
      <div class="window-controls">
      <button type="button" class="ctrl-btn" title="最小化" @click="handleMinimize">
        <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      <button type="button" class="ctrl-btn" :title="isMaximized ? '还原' : '最大化'" @click="handleMaximize">
        <svg v-if="isMaximized" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 1.5H8.5V7.5" stroke="currentColor" stroke-width="1" />
          <rect x="1" y="2.5" width="6.5" height="6.5" stroke="currentColor" stroke-width="1" fill="none" />
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="1" y="1" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none" />
        </svg>
      </button>

      <button type="button" class="ctrl-btn close-btn" title="关闭" @click="handleClose">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</header>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  min-height: 34px;
  background: #f8fafc;
  border-bottom: 1px solid #eef1f6;
  user-select: none;
  -webkit-app-region: drag;
  position: relative;
  z-index: 50;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 12px;
  -webkit-app-region: no-drag;
}

.brand {
  display: flex;
  align-items: center;
  gap: 6px;
}
.logo {
  width: 17px;
  height: 17px;
  border-radius: 4px;
  background: #0f172a;
  color: #ffffff;
  font-size: 9.5px;
  font-weight: 700;
  display: grid;
  place-items: center;
  line-height: 1;
}
.app-title {
  font-size: 11.5px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.menubar {
  display: flex;
  align-items: center;
  gap: 2px;
}

.menu-item {
  position: relative;
}

.menu-btn {
  border: none;
  background: transparent;
  color: #475569;
  font-size: 11.5px;
  font-family: inherit;
  padding: 3px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.menu-btn:hover,
.menu-item.open .menu-btn {
  color: #0f172a;
  background: #e2e8f0;
}

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: max-content;
  min-width: 215px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.06);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 1px;
  animation: drop-in 0.12s ease-out;
}

@keyframes drop-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  white-space: nowrap;
  width: 100%;
  border: none;
  background: transparent;
  color: #334155;
  font-size: 12px;
  font-family: inherit;
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.1s ease;
}
.dropdown-item span {
  white-space: nowrap;
}
.dropdown-item:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.dropdown-item.checked {
  font-weight: 600;
  color: #1d4ed8;
}

.dropdown-label {
  padding: 5px 10px 2px;
  font-size: 10.5px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
}

.shortcut {
  font-size: 11px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  margin-left: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.check {
  font-size: 12px;
  color: #2563eb;
  font-weight: bold;
}

.divider {
  height: 1px;
  background: #f1f5f9;
  margin: 3px 0;
}

.theme-entry {
  display: flex;
  align-items: center;
  gap: 7px;
}
.theme-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.custom-pill {
  font-size: 9px;
  line-height: 1;
  padding: 1px 4px;
  border-radius: 4px;
  background: #ecfdf5;
  color: #07c160;
  font-weight: 600;
  margin-left: 2px;
}

.center-section {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: calc(100% - 600px);
  height: 100%;
  pointer-events: none;
}

.file-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: #475569;
  padding: 2px 8px;
  border-radius: 5px;
  max-width: 100%;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  flex: none;
}
.dot.dirty {
  background: #f59e0b;
}

.file-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-badge {
  font-size: 10px;
  color: #b45309;
  background: #fef3c7;
  padding: 0 5px;
  border-radius: 999px;
  font-weight: 500;
}

.right-section {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.window-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.ctrl-btn {
  border: none;
  background: transparent;
  width: 44px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}
.ctrl-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}
.ctrl-btn.close-btn:hover {
  background: #ef4444;
  color: #ffffff;
}
</style>
