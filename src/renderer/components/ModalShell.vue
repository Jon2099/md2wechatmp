<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

withDefaults(defineProps<{
  labelledby: string
  describedby?: string
  width?: string
  dismissOnBackdrop?: boolean
}>(), { width: '480px', dismissOnBackdrop: true })
const emit = defineEmits<{ close: [] }>()
const dialog = shallowRef<HTMLDialogElement | null>(null)
let previousFocus: HTMLElement | null = null
const pointerStartedOutside = shallowRef(false)

function outside(event: MouseEvent): boolean {
  const bounds = dialog.value!.getBoundingClientRect()
  return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
}

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement : null
  dialog.value?.showModal()
})
onBeforeUnmount(() => {
  dialog.value?.close()
  const focusTarget = previousFocus?.isConnected ? previousFocus
    : document.querySelector<HTMLElement>('dialog[open] button') ?? document.querySelector<HTMLElement>('.cm-content')
  focusTarget?.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="app-modal"
      :style="{ '--modal-width': width }"
      :aria-labelledby="labelledby"
      :aria-describedby="describedby"
      aria-modal="true"
      @cancel.prevent.stop="emit('close')"
      @keydown.stop
      @pointerdown="pointerStartedOutside = outside($event)"
      @click="dismissOnBackdrop && pointerStartedOutside && outside($event) && emit('close')"
    >
      <slot />
    </dialog>
  </Teleport>
</template>

<style>
.app-modal {
  --modal-surface: #ffffff;
  --modal-heading: #0f172a;
  --modal-muted: #64748b;
  --modal-border: #e8edf5;
  --modal-accent: var(--app-accent, #1d4ed8);
  width: min(var(--modal-width), calc(100vw - 40px));
  max-width: none;
  max-height: calc(100dvh - 48px);
  padding: 0;
  border: 1px solid var(--modal-border);
  border-radius: 18px;
  color: var(--app-text);
  background: var(--modal-surface);
  box-shadow: 0 24px 80px #0f172a29, 0 4px 16px #0f172a0d;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-app-region: no-drag;
}
.app-modal[open] { display: flex; flex-direction: column; animation: app-modal-in 180ms ease-out; }
.app-modal::backdrop { background: #0f172a52; backdrop-filter: blur(5px); }
.app-modal :is(.modal-head, .diag-head) { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 24px 26px 18px; border-bottom: 1px solid var(--modal-border); flex-shrink: 0; }
.app-modal :is(.modal-title, .diag-title) { margin: 0; font-size: 18px; font-weight: 650; color: var(--modal-heading); letter-spacing: -.01em; }
.app-modal :is(.modal-subtitle, .diag-subtitle) { margin: 6px 0 0; line-height: 1.6; font-size: 12px; color: var(--modal-muted); }
.app-modal .close-btn { display: grid; place-items: center; width: 32px; height: 32px; padding: 6px; border: 0; border-radius: 8px; background: transparent; color: var(--modal-muted); flex-shrink: 0; cursor: pointer; transition: color 150ms ease, background-color 150ms ease; }
.app-modal .close-btn:hover { color: var(--modal-heading); background: #f1f5f9; }
.app-modal .modal-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 26px; border-top: 1px solid var(--modal-border); background: #fbfcfe; flex-shrink: 0; }
.app-modal .foot-tip { font-size: 12px; line-height: 1.5; color: var(--modal-muted); }
.app-modal .done-btn { min-height: 36px; padding: 7px 18px; border: 1px solid var(--modal-accent); border-radius: 8px; background: var(--modal-accent); color: #fff; font-size: 13px; font-weight: 500; flex-shrink: 0; cursor: pointer; transition: background-color 150ms ease; }
.app-modal .done-btn:hover { background: #1e40af; }
.app-modal button:focus-visible { outline: 3px solid #1d4ed860; outline-offset: 3px; }
@keyframes app-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .app-modal[open] { animation: none; }
  .app-modal :is(.done-btn, .close-btn) { transition: none; }
}
@media (max-width: 520px) {
  .app-modal :is(.modal-head, .diag-head) { padding: 20px; }
  .app-modal .modal-foot { padding: 16px 20px; flex-wrap: wrap; }
}
</style>
