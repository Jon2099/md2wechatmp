/// <reference types="vite/client" />

import type { Md2wBridge } from '@shared/contracts/ipc'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare global {
  interface Window {
    md2w?: Md2wBridge
  }
}

export {}
