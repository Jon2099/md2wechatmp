import juice from 'juice'
import type { InlinerPort } from '../pipeline/types'

export function createJuiceInliner(): InlinerPort {
  return {
    inline(html: string, css: string): string {
      return juice.inlineContent(html, css, {
        applyStyleTags: false,
        removeStyleTags: false,
        preserveImportant: false,
        insertPreservedExtraCss: false,
        resolveCSSVariables: true,
        applyAttributesTableElements: false,
        applyWidthAttributes: false,
        applyHeightAttributes: false,
        inlinePseudoElements: false,
      })
    },
  }
}
