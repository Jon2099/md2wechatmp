import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified, type Processor } from 'unified'
import type { MdNode } from '../pipeline/types'

/** Reject ambiguous currency spans before Markdown consumes emphasis and breaks. */
function guardDollarMath(this: Processor): void {
  for (const extension of this.data().micromarkExtensions ?? []) {
    const entry = extension.text?.[36]
    for (const construct of Array.isArray(entry) ? entry : entry ? [entry] : []) {
      if (construct.name !== 'mathText') continue
      const tokenize = construct.tokenize
      construct.tokenize = function (effects, ok, nok) {
        const start = this.now()
        return tokenize.call(this, effects, (code) => {
          const source = this.sliceSerialize({ start, end: this.now() })
          // Single dollars must hug their content, stay on one line, and cannot
          // close immediately before a digit (e.g. "$5 and $10"). $$ is explicit.
          if (!source.startsWith('$$')) {
            const content = source.slice(1, -1)
            if (/^\s|\s$|[\r\n]/u.test(content) || (code !== null && code >= 48 && code <= 57)) {
              return nok(code)
            }
          }
          return ok(code)
        }, nok)
      }
    }
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm, { singleTilde: false })
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkMath)
  .use(guardDollarMath)

function promoteDisplayMath(node: MdNode, source: string): void {
  if (node.type === 'paragraph' && node.children?.length === 1) {
    const child = node.children[0]
    if (child.type === 'inlineMath' && child.position) {
      const original = source.slice(child.position.start.offset, child.position.end.offset)
      if (original.startsWith('$$') && original.endsWith('$$')) {
        node.type = 'math'
        node.value = child.value
        delete node.children
      }
    }
  }
  for (const child of node.children ?? []) promoteDisplayMath(child, source)
}

export function parseMarkdown(source: string): MdNode {
  const root = processor.parse(source) as unknown as MdNode
  promoteDisplayMath(root, source)
  return root
}
