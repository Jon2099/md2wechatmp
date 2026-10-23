<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
  }>(),
  { size: 20 },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="app-logo-svg"
  >
    <defs>
      <!-- 主背景渐变：微信官方品牌绿 (#07c160) -->
      <linearGradient id="logo-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#09d66c" />
        <stop offset="50%" stop-color="#07c160" />
        <stop offset="100%" stop-color="#059b4c" />
      </linearGradient>

      <!-- 文档纸张白色微渐变 -->
      <linearGradient id="logo-paper" x1="8" y1="5" x2="24" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#f8fafc" />
      </linearGradient>

      <!-- 折角微光渐变 -->
      <linearGradient id="logo-paper-fold" x1="19" y1="5" x2="24" y2="10.5" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#e2e8f0" />
      </linearGradient>
    </defs>

    <!-- 外圈圆角容器：纯净无边框微信官方绿底色 -->
    <rect width="32" height="32" rx="7.5" fill="url(#logo-bg)" />

    <!-- 文稿纸张白底（右上角折角切角） -->
    <path
      d="M8.5 7.5 C8.5 6.4 9.4 5.5 10.5 5.5 H19 L23.5 10 V24.5 C23.5 25.6 22.6 26.5 21.5 26.5 H10.5 C9.4 26.5 8.5 25.6 8.5 24.5 Z"
      fill="url(#logo-paper)"
    />

    <!-- 右上角翻折页角与微阴影 -->
    <path
      d="M19 5.5 L23.5 10 H20 C19.4 10 19 9.6 19 9 Z"
      fill="url(#logo-paper-fold)"
    />
    <!-- 折角微光星芒：微信绿点缀 -->
    <circle cx="21" cy="7.5" r="0.8" fill="#07c160" />

    <!-- 排版内容线条：微信微光浮雕与玉质调（告别生硬黑灰，纯净温润，视觉高度统一） -->
    <!-- 一级大标题 -->
    <rect x="10.5" y="9.5" width="8.5" height="2.2" rx="0.6" fill="#07c160" fill-opacity="0.9" />

    <!-- 正文段落线条（层次分明的玉质排版行） -->
    <rect x="10.5" y="13.5" width="11" height="1.6" rx="0.6" fill="#07c160" fill-opacity="0.4" />
    <rect x="10.5" y="16.5" width="9.5" height="1.6" rx="0.6" fill="#07c160" fill-opacity="0.28" />
    <rect x="10.5" y="19.5" width="11" height="1.6" rx="0.6" fill="#07c160" fill-opacity="0.38" />
    <rect x="10.5" y="22.5" width="7.5" height="1.6" rx="0.6" fill="#07c160" fill-opacity="0.25" />
  </svg>
</template>

<style scoped>
.app-logo-svg {
  display: block;
  flex-shrink: 0;
}
</style>
