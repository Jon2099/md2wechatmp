<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ThemeProfile } from '@shared/models/theme'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'
import { buildThemeCss } from '@themes/build-css'
import { themeProfileSchema } from '@themes/schema'
import { changedPreviewTarget, PREVIEW_LABELS, previewHeadingPrefix, previewValues, type PreviewTarget } from './preview-model'

const props = defineProps<{ draft: ThemeProfile }>()
const viewport = ref<HTMLElement | null>(null)
const host = ref<HTMLElement | null>(null)
const article = ref<HTMLElement | null>(null)
const shadow = shallowRef<ShadowRoot | null>(null)
const activeTarget = ref<PreviewTarget | null>(null)
const compiledCss = ref('')
const paperColor = ref('#ffffff')
let scrollTimer: ReturnType<typeof setTimeout> | undefined

// Isolate all production selectors, including strong/em and compound selectors.
onMounted(() => { shadow.value = host.value!.attachShadow({ mode: 'open' }) })
onBeforeUnmount(() => clearTimeout(scrollTimer))
watch(() => props.draft, theme => {
  // Keep valid styles while typing a hex value; metadata may be temporarily empty.
  const parsed = themeProfileSchema.safeParse({ ...theme, name: '预览', description: '预览' })
  if (parsed.success) {
    compiledCss.value = buildThemeCss(parsed.data as ThemeProfile, {
      ...DEFAULT_COMPILE_OPTIONS, firstLineIndent: true,
    }).css
    paperColor.value = parsed.data.colors.background
  }
}, { deep: true, immediate: true })

const headingPrefix = (index: number) => previewHeadingPrefix(props.draft.headings.numbering, index)

function locate(target: PreviewTarget): void {
  activeTarget.value = target
  const container = viewport.value
  const sample = article.value?.querySelector<HTMLElement>(`[data-preview-target="${target}"]`)
  if (!container || !sample) return
  const bounds = container.getBoundingClientRect()
  const rect = sample.getBoundingClientRect()
  // Avoid repeated movement while dragging a slider or color picker.
  if (rect.top >= bounds.top + 12 && rect.top + Math.min(rect.height, 140) <= bounds.bottom - 12) return
  container.scrollTo({
    top: Math.max(0, container.scrollTop + rect.top - bounds.top - 24),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
watch(() => ({ profile: props.draft, values: previewValues(props.draft) }), (next, previous) => {
  if (next.profile !== previous.profile) {
    clearTimeout(scrollTimer)
    activeTarget.value = null
    return
  }
  const target = changedPreviewTarget(next.values, previous.values)
  if (!target) return
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => locate(target), 120)
}, { flush: 'post' })
</script>

<template>
  <div class="preview-panel">
    <div class="preview-header">
      <div class="preview-heading">
        <span class="preview-title">实时排版预览</span>
        <span class="preview-tag">{{ draft.name || '未命名主题' }}</span>
      </div>
      <div class="preview-toolbar">
        <p class="preview-hint" role="status">{{ activeTarget ? `正在预览：${PREVIEW_LABELS[activeTarget]}` : '修改左侧设置，自动定位对应示例' }}</p>
        <button type="button" class="preview-top" @click="locate('title')">回到顶部</button>
      </div>
    </div>
    <div ref="viewport" class="preview-viewport" aria-label="主题样稿预览">
      <div ref="host" class="preview-container" :style="{ backgroundColor: paperColor }"></div>
    </div>
    <Teleport v-if="shadow" :to="shadow">
      <component is="style" type="text/css">{{ compiledCss }}</component>
      <component is="style" type="text/css">
        :host { display: block; }
        *, *::before, *::after { box-sizing: border-box; }
        .preview-document { padding: 24px 20px; }
        [data-active="true"] { outline: 1px dashed #94a3b8; outline-offset: 5px; }
        .sample-caption { font: 12px/1.6 system-ui, sans-serif; color: #64748b; margin: 0 0 10px; text-indent: 0; letter-spacing: 0; text-align: left; }
        .sample-group { display: flow-root; margin-bottom: 12px; }
      </component>
      <section ref="article" class="md2w-root preview-document">
        <div data-preview-target="paper"></div>
        <header data-preview-target="title" :data-active="activeTarget === 'title'">
          <p class="md2w-eyebrow">城市观察 · 周末来信</p>
          <h1 class="md2w-h1">把平凡的日子，写成值得收藏的故事</h1>
        </header>
        <section data-preview-target="accent" :data-active="activeTarget === 'accent'" class="sample-group">
          <p class="sample-caption">品牌主色示例 · 提示块左侧强调线</p>
          <section class="md2w-callout">
            <section class="md2w-callout-title">给阅读留一点呼吸的空间</section>
            <section class="md2w-p">从一个清晰的主题开始，用颜色标记值得停留的内容，让长文也能轻松阅读。</section>
          </section>
        </section>
        <section data-preview-target="paragraph" :data-active="activeTarget === 'paragraph'" class="sample-group">
          <section class="md2w-p">周末清晨，沿着熟悉的河岸散步。树影落在石阶上，路边的小店刚刚开门。把这些细微的观察记下来，就是一篇文章的开始。</section>
          <section class="md2w-p">好的排版让文字的节奏自然显现。试着调整正文字号、行高、字距与段落间距，比较连续两段文字的阅读感受，也可以切换首行缩进和对齐方式。</section>
        </section>
        <section class="md2w-p"><strong data-preview-target="strong" :data-active="activeTarget === 'strong'">重要的观点，值得被清晰地看见。</strong> 也可以用<em>斜体</em>表达语气，用<del>删除线</del>记录修改。</section>
        <section class="md2w-p" data-preview-target="link" :data-active="activeTarget === 'link'">延伸阅读：<span class="md2w-link">如何记录日常中的灵感</span><span class="md2w-link-ref">[1]</span>，让读者继续探索感兴趣的话题。</section>
        <section data-preview-target="headings" :data-active="activeTarget === 'headings'" class="sample-group">
          <h2 class="md2w-h2">{{ headingPrefix(1) }}从日常里发现一个好故事</h2>
          <h3 class="md2w-h3">三级标题 · 先观察，再表达</h3>
          <h4 class="md2w-h4">四级标题 · 收集具体细节</h4>
          <h5 class="md2w-h5">五级标题 · 整理表达顺序</h5>
          <h6 class="md2w-h6">六级标题 · 保留真实感受</h6>
        </section>
        <section data-preview-target="quote" :data-active="activeTarget === 'quote'" class="sample-group">
          <h2 class="md2w-h2">{{ headingPrefix(2) }}让值得回味的话停留片刻</h2>
          <blockquote class="md2w-quote">文字不必总是宏大。把一件小事说清楚，把一种感受写具体，就足以打动愿意认真阅读的人。</blockquote>
        </section>
        <h3 class="md2w-h3">把灵感整理成清单</h3>
        <ul class="md2w-list md2w-ul-1">
          <li class="md2w-li">记录一个有画面感的瞬间。
            <ul class="md2w-list md2w-ul-2"><li class="md2w-li">补充当时的声音、颜色与气味。</li></ul>
          </li>
          <li class="md2w-li">找到文章最想传达的一个观点。</li>
        </ul>
        <ol class="md2w-list md2w-ol-1"><li class="md2w-li">先完成初稿。</li><li class="md2w-li">再检查层级与阅读节奏。</li></ol>
        <section data-preview-target="code" :data-active="activeTarget === 'code'" class="sample-group">
          <h2 class="md2w-h2">{{ headingPrefix(3) }}把方法分享给更多人</h2>
          <section class="md2w-p">使用 <code class="md2w-code">collectIdeas()</code> 记录灵感，再用一段简洁的代码说明工作流程。</section>
          <pre class="md2w-pre"><code class="md2w-code-block">// 从观察到发布
function writeStory(ideas) {
  const draft = ideas.join('\n')
  return publish(draft)
}</code></pre>
        </section>
        <section data-preview-target="table" :data-active="activeTarget === 'table'" class="sample-group">
          <h2 class="md2w-h2">{{ headingPrefix(4) }}给文章做一次发布前检查</h2>
          <table class="md2w-table">
            <thead><tr><th class="md2w-th">检查项目</th><th class="md2w-th">建议做法</th></tr></thead>
            <tbody>
              <tr><td class="md2w-td">文章结构</td><td class="md2w-td">标题层级清晰</td></tr>
              <tr><td class="md2w-td md2w-td--zebra">阅读节奏</td><td class="md2w-td md2w-td--zebra">长短段落交替</td></tr>
              <tr><td class="md2w-td">重点内容</td><td class="md2w-td">适量加粗与引用</td></tr>
              <tr><td class="md2w-td md2w-td--zebra">发布准备</td><td class="md2w-td md2w-td--zebra">核对链接与脚注</td></tr>
            </tbody>
          </table>
        </section>
        <section data-preview-target="divider" :data-active="activeTarget === 'divider'" class="sample-group">
          <p class="sample-caption">分割线示例 · 为下一段内容留白</p>
          <section class="md2w-divider"></section>
        </section>
        <section data-preview-target="border" :data-active="activeTarget === 'border'" class="sample-group">
          <section class="md2w-notice">编者按：发布之前，再读一遍文章，确认每个细节都传达了你想表达的内容。</section>
        </section>
        <section data-preview-target="secondary" :data-active="activeTarget === 'secondary'" class="sample-group">
          <section class="md2w-section-title">{{ draft.labels.footnoteSection }}</section>
          <section class="md2w-footnotes"><section class="md2w-footnote-item">[1] 本文为主题预览样稿，文字仅用于展示排版效果。</section></section>
          <section class="md2w-section-title">{{ draft.labels.linkSection }}</section>
          <section class="md2w-links"><section class="md2w-footnote-item">[1] 日常灵感记录指南 · example.com/ideas</section></section>
        </section>
      </section>
    </Teleport>
  </div>
</template>

<style scoped>
.preview-panel { display: flex; flex-direction: column; height: 100%; background: #f8fafc; border-left: 1px solid #e2e8f0; overflow: hidden; }
.preview-header { padding: 12px 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }
.preview-heading, .preview-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.preview-heading { margin-bottom: 6px; }
.preview-title { font-size: 13px; font-weight: 600; color: #334155; flex-shrink: 0; }
.preview-tag { font-size: 12px; color: #475569; background: #f1f5f9; padding: 2px 8px; border-radius: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-hint { font-size: 12px; line-height: 1.5; color: #64748b; margin: 0; }
.preview-top { flex-shrink: 0; padding: 4px; border: 0; background: transparent; color: #475569; font-size: 12px; cursor: pointer; }
.preview-top:hover { text-decoration: underline; }
.preview-top:focus-visible { outline: 2px solid #64748b; outline-offset: 2px; }
.preview-viewport { flex: 1; min-height: 0; padding: 20px; overflow-y: auto; overflow-anchor: none; overscroll-behavior: contain; }
.preview-container { width: 100%; max-width: 375px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 12px #0000000d; }
</style>
