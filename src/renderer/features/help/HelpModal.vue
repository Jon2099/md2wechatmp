<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  dismissOnStartup: boolean
}>()

const emit = defineEmits<{
  close: []
  'update:dismissOnStartup': [boolean]
}>()

const dontShowAgain = ref(props.dismissOnStartup)

watch(
  () => props.dismissOnStartup,
  (val) => {
    dontShowAgain.value = val
  },
)

function onToggleDismiss() {
  emit('update:dismissOnStartup', dontShowAgain.value)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>
<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <header class="modal-head">
        <div>
          <h2 id="help-modal-title" class="modal-title">使用说明与排版技巧</h2>
          <p class="modal-subtitle">左侧写 Markdown，右侧排版，一键复制进公众号后台</p>
        </div>
        <button type="button" class="close-btn" aria-label="关闭" @click="emit('close')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <div class="modal-body">
        <!-- 步骤指南 -->
        <section class="help-section">
          <h3 class="section-title">三步快速上手</h3>
          <div class="steps-grid">
            <div class="step-card">
              <span class="step-num">1</span>
              <div>
                <strong>左侧写 Markdown</strong>
                <p>支持常规语法，快捷键 Ctrl+Enter 立即转换。</p>
              </div>
            </div>
            <div class="step-card">
              <span class="step-num">2</span>
              <div>
                <strong>底部换主题</strong>
                <p>点击状态栏主题名，随时更换配色与版式风格。</p>
              </div>
            </div>
            <div class="step-card">
              <span class="step-num">3</span>
              <div>
                <strong>复制进公众号</strong>
                <p>点击「复制到微信」，到微信后台直接 Ctrl+V 粘贴。</p>
              </div>
            </div>
          </div>
        </section>
        <!-- 重点：图片与视频占位说明 -->
        <section class="help-section media-section">
          <div class="video-notice-card">
            <div class="notice-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>重要注意：视频无法直接粘贴</span>
            </div>
            <p class="video-notice-text">
              微信公众号限制外部视频外链。排版中的视频仅为<strong>位置占位</strong>，复制到微信后<strong>必须手动上传或替换</strong>：
            </p>
            <div class="action-steps">
              <span class="action-step">1. 粘贴到微信公众号后台</span>
              <span class="action-step">2. 点击编辑器顶部的<strong>「视频」</strong>图标</span>
              <span class="action-step">3. <strong>手动上传本地视频</strong>或<strong>关联视频号</strong>替换占位</span>
            </div>
            <p class="video-audit-warning">（本地视频需上传并等待审核，复制不会复制视频）</p>
          </div>

          <div class="image-notice-card">
            <div class="img-badge">
              <span>📷 图片支持直接粘贴</span>
            </div>
            <p class="img-notice-text">
              截好图或复制好本地图片后，在微信后台选中占位图按 <code>Ctrl+V</code> 即可瞬间替换。
            </p>
          </div>
        </section>

        <!-- 实用特性小贴士 -->
        <section class="help-section tips-section">
          <h3 class="section-title">实用排版技巧</h3>
          <ul class="tips-list">
            <li><strong>局部文字样式</strong>：在右侧预览中选中文字，用浮动工具条修改颜色或字号并点击「应用」。修改会同步回左侧 Markdown，保存和复制时均会保留；文字字形使用主题默认字体。选中后按 Tab 可进入工具条，Esc 关闭。</li>
            <li><strong>数学公式</strong>：默认生成清晰的矢量 SVG，公式在手机和电脑端放大均不失真。</li>
            <li><strong>超宽表格</strong>：若手机上表格容易被切断，在「选项」中开启「转为文字卡片」更易读。</li>
            <li><strong>链接收纳</strong>：微信正文不支持点开外部网址，工具会自动收录为文末「参考链接」。</li>
          </ul>
        </section>
      </div>

      <footer class="modal-foot">
        <label class="dismiss-checkbox">
          <input
            v-model="dontShowAgain"
            type="checkbox"
            @change="onToggleDismiss"
          />
          <span>下次启动不再自动弹出</span>
        </label>
        <button type="button" class="done-btn" @click="emit('close')">知道了，开始使用</button>
      </footer>
    </div>
  </div>
</template>
<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-card {
  width: 100%;
  max-width: 540px;
  max-height: 85vh;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-in 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid #eef1f6;
  background: #fafbfc;
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.modal-subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 4px 0 0;
}
.close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.section-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 10px;
}
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.step-card {
  background: #f8fafc;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #1d4ed8;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}
.step-card strong {
  display: block;
  font-size: 12.5px;
  color: #1e293b;
  margin-bottom: 2px;
}
.step-card p {
  font-size: 11.5px;
  color: #64748b;
  margin: 0;
  line-height: 1.45;
}
.media-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.video-notice-card {
  background: #fff7ed;
  border: 1.5px solid #fdba74;
  border-radius: 9px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.notice-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #c2410c;
  font-size: 12.5px;
  font-weight: 700;
}
.video-notice-text {
  font-size: 12px;
  color: #7c2d12;
  margin: 0;
  line-height: 1.55;
}
.video-notice-text strong {
  color: #9a3412;
}
.action-steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  padding: 8px 10px;
}
.action-step {
  font-size: 11.5px;
  color: #431407;
  line-height: 1.45;
}
.action-step strong {
  color: #c2410c;
}
.video-audit-warning {
  margin: 3px 0 0;
  font-size: 11.5px;
  font-weight: 600;
  color: #dc2626;
}
.image-notice-card {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 9px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.img-badge {
  font-size: 12px;
  font-weight: 700;
  color: #15803d;
}
.img-notice-text {
  font-size: 11.5px;
  color: #166534;
  margin: 0;
  line-height: 1.5;
}
.img-notice-text code {
  background: rgba(22, 101, 52, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}
.tips-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #475569;
  line-height: 1.65;
}
.tips-list li {
  margin-bottom: 4px;
}
.tips-list strong {
  color: #1e293b;
}
.modal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #eef1f6;
  background: #fafbfc;
}
.dismiss-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  user-select: none;
}
.dismiss-checkbox input {
  cursor: pointer;
}
.done-btn {
  background: #1d4ed8;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease;
}
.done-btn:hover {
  background: #1e40af;
}
</style>
