<script setup lang="ts">
import ModalShell from '../../components/ModalShell.vue'
import AppLogo from '../../components/AppLogo.vue'
import qrcodeUrl from '../../assets/author-qrcode.jpg'

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <ModalShell labelledby="about-modal-title" width="520px" @close="emit('close')">
    <header class="modal-head">
      <div class="brand-header">
        <AppLogo :size="40" />
        <div>
          <div class="title-row">
            <h2 id="about-modal-title" class="modal-title">排版助手</h2>
            <span class="version-tag">v0.1.0</span>
          </div>
          <p class="modal-subtitle">免费微信公众号文章辅助排版软件</p>
        </div>
      </div>
      <button type="button" class="close-btn" aria-label="关闭" @click="emit('close')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="about-body">
      <!-- 隐私与本地声明 -->
      <section class="privacy-box">
        <div class="privacy-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div class="privacy-content">
          <div class="privacy-title">纯本地软件 · 没有任何网络请求</div>
          <div class="privacy-desc">
            所有排版渲染、公式生成与图片处理均在您本地设备上离线完成，无联网上报，无需担心隐私与数据安全。
          </div>
        </div>
      </section>

      <!-- 作者与公众号关注 -->
      <section class="author-section">
        <div class="author-info">
          <div class="author-row">
            <span class="author-label">软件作者</span>
            <span class="author-name">Jonathan</span>
          </div>
          <div class="qrcode-card">
            <img :src="qrcodeUrl" alt="微信公众号二维码" class="qrcode-img" />
            <div class="qrcode-info">
              <span class="mp-tag">微信公众号</span>
              <p class="qrcode-tip">
                作者公众号，欢迎交流。给个关注吧~ ✨
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <footer class="modal-foot">
      <div class="foot-tip">Made with ❤️ for Creators</div>
      <button type="button" class="done-btn" @click="emit('close')">关闭</button>
    </footer>
  </ModalShell>
</template>

<style scoped>
.brand-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.version-tag {
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 1px 6px;
  border-radius: 999px;
}
.about-body {
  padding: 20px 26px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.privacy-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
}
.privacy-icon {
  color: #16a34a;
  flex-shrink: 0;
  margin-top: 1px;
}
.privacy-title {
  font-size: 13.5px;
  font-weight: 650;
  color: #15803d;
  margin-bottom: 4px;
}
.privacy-desc {
  font-size: 12px;
  line-height: 1.6;
  color: #166534;
}
.author-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
}
.author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #edf2f7;
}
.author-label {
  font-size: 12px;
  color: #64748b;
}
.author-name {
  font-size: 13.5px;
  font-weight: 650;
  color: #0f172a;
}
.qrcode-card {
  display: flex;
  align-items: center;
  gap: 16px;
}
.qrcode-img {
  width: 110px;
  height: 110px;
  object-fit: contain;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 4px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
  flex-shrink: 0;
}
.qrcode-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mp-tag {
  display: inline-block;
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 1px 8px;
  border-radius: 4px;
}
.qrcode-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #475569;
}
.done-btn {
  padding: 7px 18px;
  font-size: 12.5px;
  font-weight: 600;
  color: #ffffff;
  background: var(--modal-accent, #1d4ed8);
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: opacity 150ms ease;
}
.done-btn:hover {
  opacity: 0.9;
}
</style>
