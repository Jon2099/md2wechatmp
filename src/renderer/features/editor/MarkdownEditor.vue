<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'

const props = defineProps<{ modelValue: string; hint?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null
let muted = false

const editorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '14px',
      backgroundColor: '#ffffff',
      color: '#1f2937',
    },
    '.cm-scroller': {
      fontFamily:
        "'JetBrains Mono', 'Cascadia Code', 'Source Han Mono SC', Consolas, 'Microsoft YaHei', monospace",
      lineHeight: '1.75',
      padding: '18px 0 80px',
    },
    '.cm-content': {
      caretColor: '#1d4ed8',
      padding: '0 20px 0 8px',
    },
    '.cm-gutters': {
      backgroundColor: '#fbfcfe',
      color: '#c2c8d2',
      border: 'none',
      borderRight: '1px solid #eef1f6',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(29, 78, 216, 0.045)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(29, 78, 216, 0.06)', color: '#7c8698' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(29, 78, 216, 0.16)',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#1d4ed8', borderLeftWidth: '2px' },
    '.cm-searchMatch': { backgroundColor: 'rgba(250, 204, 21, 0.35)' },
    '.cm-placeholder': { color: '#a3aab6' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: false },
)

function buildState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown({ base: markdownLanguage, addKeymap: true }),
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      placeholderExt(props.hint ?? '在这里写 Markdown，右侧实时得到微信可粘贴的排版结果…'),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || muted) return
        emit('update:modelValue', update.state.doc.toString())
      }),
      editorTheme,
    ],
  })
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({ state: buildState(props.modelValue), parent: host.value })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(
  () => props.modelValue,
  (value) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    muted = true
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    muted = false
  },
)

function revealLine(line: number): void {
  if (!view) return
  const doc = view.state.doc
  const target = Math.min(Math.max(Math.trunc(line) || 1, 1), doc.lines)
  const info = doc.line(target)
  view.dispatch({
    selection: { anchor: info.from, head: info.to },
    scrollIntoView: true,
  })
  view.focus()
}

function focus(): void {
  view?.focus()
}

defineExpose({ revealLine, focus })
</script>

<template>
  <div ref="host" class="editor-host" />
</template>

<style scoped>
.editor-host {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.editor-host :deep(.cm-editor) {
  height: 100%;
}
</style>
