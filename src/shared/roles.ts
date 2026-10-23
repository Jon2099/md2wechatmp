/**
 * 内部排版类名：只在构建样式与生成 HAST 时使用，
 * 经过 juice 内联后会在清洗阶段全部剥离，绝不进入复制结果。
 */
export const ROLES = {
  root: 'md2w-root',
  eyebrow: 'md2w-eyebrow',
  h1: 'md2w-h1',
  h2: 'md2w-h2',
  h3: 'md2w-h3',
  h4: 'md2w-h4',
  h5: 'md2w-h5',
  h6: 'md2w-h6',
  p: 'md2w-p',
  image: 'md2w-image',
  quote: 'md2w-quote',
  callout: 'md2w-callout',
  calloutWarn: 'md2w-callout--warn',
  calloutTitle: 'md2w-callout-title',
  list: 'md2w-list',
  listNone: 'md2w-list--none',
  li: 'md2w-li',
  task: 'md2w-task',
  code: 'md2w-code',
  pre: 'md2w-pre',
  codeBlock: 'md2w-code-block',
  table: 'md2w-table',
  tableCompact: 'md2w-table--compact',
  th: 'md2w-th',
  td: 'md2w-td',
  tr: 'md2w-tr',
  zebra: 'md2w-td--zebra',
  divider: 'md2w-divider',
  link: 'md2w-link',
  linkRef: 'md2w-link-ref',
  fnRef: 'md2w-fn-ref',
  sectionTitle: 'md2w-section-title',
  links: 'md2w-links',
  footnotes: 'md2w-footnotes',
  footnoteItem: 'md2w-footnote-item',
  math: 'md2w-math',
  mathBlock: 'md2w-math-block',
  mathSvg: 'md2w-math-svg',
  mathBlockSvg: 'md2w-math-block-svg',
  notice: 'md2w-notice',
} as const

export function ulRole(depth: number): string {
  return `md2w-ul-${Math.min(Math.max(depth, 1), 3)}`
}

export function olRole(depth: number): string {
  return `md2w-ol-${Math.min(Math.max(depth, 1), 3)}`
}
