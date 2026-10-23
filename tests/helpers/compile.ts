import { createConverterDeps, compileDocument } from '@converter/index'
import { DEFAULT_COMPILE_OPTIONS } from '@shared/models/compile'
import type { CompileOptions } from '@shared/models/compile'
import type { ContentSnapshot } from '@shared/models/snapshot'
import { getTheme } from '@themes/builtins/index'

const deps = createConverterDeps()

export interface CompileOverrides {
  baseDir?: string
  themeId?: string
  options?: Partial<CompileOptions>
}

export async function compile(markdown: string, overrides: CompileOverrides = {}): Promise<ContentSnapshot> {
  return compileDocument(
    {
      baseDir: overrides.baseDir,
      docId: 'doc-test',
      revision: 1,
      markdown,
      theme: getTheme(overrides.themeId ?? 'ocean-blue'),
      options: { ...DEFAULT_COMPILE_OPTIONS, highlight: false, ...overrides.options },
    },
    deps,
  )
}

export function errorsOf(snapshot: ContentSnapshot): string[] {
  return snapshot.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message)
}

export function placeholderTexts(snapshot: ContentSnapshot): string[] {
  return snapshot.placeholders.map((record) => record.text)
}
