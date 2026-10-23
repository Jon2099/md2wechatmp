import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/** 供 vite-node（scripts/）与测试复用的别名配置 */
const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@themes': resolve(__dirname, 'src/themes'),
  '@converter': resolve(__dirname, 'src/converter'),
  '@renderer': resolve(__dirname, 'src/renderer'),
}

export default defineConfig({
  resolve: { alias },
})
