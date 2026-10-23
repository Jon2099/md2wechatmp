import type { ContentSnapshot } from '@shared/models/snapshot'
import type { CompileInput, ConverterDeps, HighlighterPort, InlinerPort } from './pipeline/types'
import { runPipeline } from './pipeline/run'
import { createShikiHighlighter } from './highlight/highlighter'
import { createJuiceInliner } from './styles/inline'

export interface ConverterPorts {
  highlighter?: HighlighterPort
  inliner?: InlinerPort
}

export function createConverterDeps(ports: ConverterPorts = {}): ConverterDeps {
  return {
    highlighter: ports.highlighter ?? createShikiHighlighter(),
    inliner: ports.inliner ?? createJuiceInliner(),
  }
}

export async function compileDocument(
  input: CompileInput,
  deps: ConverterDeps = createConverterDeps(),
): Promise<ContentSnapshot> {
  return runPipeline(input, deps)
}

export type { CompileInput, ConverterDeps, ContentSnapshot }
