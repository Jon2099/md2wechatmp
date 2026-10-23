import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'electron-vite'

const alias = {
  '@shared': resolve('src/shared'),
  '@themes': resolve('src/themes'),
  '@converter': resolve('src/converter'),
  '@renderer': resolve('src/renderer'),
}

/**
 * css-tree 的默认入口在运行期用 createRequire 读取 `data/patch.json` 与 mdn-data，
 * 打包成单文件后这些相对路径会失效。改用官方自包含构建（数据已内联）即可打包。
 */
const mainAlias = [
  { find: '@shared', replacement: resolve('src/shared') },
  { find: '@themes', replacement: resolve('src/themes') },
  { find: '@converter', replacement: resolve('src/converter') },
  { find: '@renderer', replacement: resolve('src/renderer') },
  { find: /^css-tree$/, replacement: resolve('node_modules/css-tree/dist/csstree.esm.js') },
]

const nodeExternals = [
  'electron',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]

export default defineConfig({
  main: {
    define: {
      PACKAGE_VERSION: JSON.stringify('3.2.2'),
    },
    resolve: { alias: mainAlias },
    build: {
      outDir: 'out/main',
      emptyOutDir: true,
      minify: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'worker/compile': resolve('src/worker/index.ts'),
        },
        external: nodeExternals,
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
        },
      },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      outDir: 'out/preload',
      emptyOutDir: true,
      minify: true,
      sourcemap: false,
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        external: nodeExternals,
        output: { format: 'cjs', entryFileNames: '[name].js' },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: { alias },
    plugins: [vue()],
    build: {
      outDir: resolve('out/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
      },
    },
  },
})
