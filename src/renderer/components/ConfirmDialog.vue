<script setup lang="ts">
import ModalShell from './ModalShell.vue'
import { resolveConfirmation, view } from '../state/store'
</script>

<template>
  <ModalShell
    v-if="view.confirmation"
    labelledby="confirm-title"
    describedby="confirm-description"
    width="480px"
    :dismiss-on-backdrop="false"
    @close="resolveConfirmation(false)"
  >
    <div class="confirm-content">
      <div class="confirm-top">
        <span class="confirm-icon" aria-hidden="true">
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6M12 12v3M12 18h.01" />
          </svg>
        </span>
        <button type="button" class="confirm-close" aria-label="取消并继续编辑" @click="resolveConfirmation(false)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
        </button>
      </div>
      <h2 id="confirm-title">{{ view.confirmation.title }}</h2>
      <p id="confirm-description">{{ view.confirmation.description }}</p>
      <div class="confirm-document" :title="view.pathLabel">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" /></svg>
        <span class="confirm-filename">{{ view.fileName }}</span>
        <span class="confirm-unsaved"><i aria-hidden="true" />未保存</span>
      </div>
    </div>
    <footer class="confirm-footer">
      <div class="confirm-actions">
        <button type="button" class="confirm-cancel" autofocus @click="resolveConfirmation(false)">继续编辑</button>
        <button type="button" class="confirm-accept" @click="resolveConfirmation(true)">{{ view.confirmation.confirmLabel }}</button>
      </div>
      <p>按 Esc 继续编辑</p>
    </footer>
  </ModalShell>
</template>

<style scoped>
.confirm-content { padding: 28px 28px 24px; }
.confirm-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.confirm-icon { display: grid; place-items: center; width: 48px; height: 48px; background: #fff7e6; color: #a86408; border: 1px solid #f9e5be; border-radius: 14px; }
.confirm-close { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: var(--modal-muted); cursor: pointer; }
.confirm-close:hover { background: #f1f5f9; color: var(--modal-heading); }
h2 { margin: 0 0 10px; color: var(--modal-heading); font-size: 21px; font-weight: 650; line-height: 1.45; letter-spacing: -.02em; }
#confirm-description { margin: 0; color: #526176; font-size: 14px; line-height: 1.85; }
.confirm-document { display: flex; align-items: center; gap: 10px; margin-top: 20px; padding: 12px 14px; border: 1px solid var(--modal-border); border-radius: 10px; background: #f8fafc; color: #475569; }
.confirm-document svg { flex-shrink: 0; color: #64748b; }
.confirm-filename { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.confirm-unsaved { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-shrink: 0; font-size: 12px; color: #92540b; }
.confirm-unsaved i { width: 5px; height: 5px; background: #b87812; border-radius: 50%; }
.confirm-footer { padding: 20px 28px 16px; border-top: 1px solid var(--modal-border); background: #fbfcfe; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
.confirm-actions button { min-height: 40px; padding: 9px 18px; border: 1px solid transparent; border-radius: 9px; font-size: 13px; font-weight: 550; cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease; }
.confirm-cancel { border-color: #d8e0eb !important; background: #fff; color: #334155; }
.confirm-cancel:hover { background: #f1f5f9; border-color: #b8c4d5 !important; }
.confirm-accept { background: var(--modal-accent); color: #fff; }
.confirm-accept:hover { background: #1e40af; }
.confirm-footer p { margin: 12px 0 0; text-align: right; font-size: 11px; color: var(--modal-muted); }
@media (max-width: 520px) {
  .confirm-content { padding: 22px 20px; }
  .confirm-footer { padding: 18px 20px 14px; }
  .confirm-actions button { padding-inline: 12px; }
}
@media (prefers-reduced-motion: reduce) { .confirm-actions button { transition: none; } }
</style>
