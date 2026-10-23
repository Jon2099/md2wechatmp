import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { CodeTokenLine, HighlighterPort } from '../pipeline/types'
import { LANG_ALIASES, LANGS, SHIKI_THEMES, THEME_ALIASES } from './languages'

interface HighlighterLike {
  codeToTokensBase: (
    code: string,
    options: { lang: string; theme: string },
  ) => Array<Array<{ content: string; color?: string }>>
}

let loading: Promise<HighlighterLike> | null = null

function load(): Promise<HighlighterLike> {
  if (!loading) {
    loading = createHighlighterCore({
      themes: SHIKI_THEMES,
      langs: LANGS,
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })
      .then((instance) => instance as unknown as HighlighterLike)
      .catch((error) => {
        loading = null
        throw error
      })
  }
  return loading
}

export function createShikiHighlighter(): HighlighterPort {
  return {
    available() {
      return true
    },
    async highlight(code, lang, themeName): Promise<CodeTokenLine[] | null> {
      if (!lang) return null
      const langId = LANG_ALIASES[lang.toLowerCase()]
      if (!langId) return null
      try {
        const highlighter = await load()
        const theme = THEME_ALIASES[themeName] ?? 'github-light'
        const lines = highlighter.codeToTokensBase(code, { lang: langId, theme })
        return lines.map((line) =>
          line.map((token) => ({ value: token.content, color: token.color ?? '#24292e' })),
        )
      } catch {
        return null
      }
    },
  }
}
