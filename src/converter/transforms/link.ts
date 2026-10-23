import type { CompileContext, MdNode } from '../pipeline/types'
import { childrenOf, textOf, transform } from '../pipeline/ast'

const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:', 'file:']

export interface LinkPlan {
  index: number
  url: string
}

export function isDangerousUrl(url: string): boolean {
  const normalized = url.trim().replace(/[\u0000-\u0020]/g, '').toLowerCase()
  return DANGEROUS_PROTOCOLS.some((protocol) => normalized.startsWith(protocol))
}

function placeholderOnly(node: MdNode): boolean {
  const children = childrenOf(node)
  return (
    children.length === 1 &&
    (children[0].type === 'wxImage' || (children[0].type === 'text' &&
    String(children[0].value ?? '').startsWith('TODO： ')))
  )
}

export function resolveLinks(root: MdNode, ctx: CompileContext): void {
  const indexByUrl = new Map<string, number>()

  const replaced = transform(root, (node) => {
    if (node.type !== 'link') return node

    if (placeholderOnly(node)) {
      ctx.diagnostics.push({
        code: 'image.link-dropped',
        severity: 'info',
        message: '图片已保留，取消图片外部跳转链接。',
        action: '保留图片或视频占位，不在文末生成点击图片的外链引用。',
        review: false,
        span: ctx.spanOf(node),
      })
      return childrenOf(node)[0]
    }

    const url = String(node.url ?? '').trim()
    if (!url) {
      return { type: 'wxLinkText', children: childrenOf(node), position: node.position }
    }

    if (isDangerousUrl(url)) {
      ctx.diagnostics.push({
        code: 'link.blocked-protocol',
        severity: 'warning',
        message: '此链接包含非安全协议（如 javascript: 等），已自动拦截。',
        action: '仅保留链接原文字，不生成可点击链接与文末引用。',
        advice: '如需保留该链接，请改用安全的 http 或 https 网址。',
        review: true,
        span: ctx.spanOf(node),
      })
      return { type: 'wxLinkText', children: childrenOf(node), position: node.position }
    }

    const existing = indexByUrl.get(url)
    let index: number
    if (existing === undefined) {
      index = indexByUrl.size + 1
      indexByUrl.set(url, index)
      ctx.links.push({ index, url, text: textOf(node), span: ctx.spanOf(node) })
      ctx.diagnostics.push({
        code: 'link.reference',
        severity: 'info',
        message: `微信正文不支持直接打开外部链接，已将其收录至文末「参考链接」。`,
        action: `正文标注角标「[链接 ${index}]」，网址收录于文末。`,
        review: false,
        span: ctx.spanOf(node),
      })
    } else {
      index = existing
      ctx.diagnostics.push({
        code: 'link.deduped',
        severity: 'info',
        message: `检测到重复网址，已自动复用编号「[链接 ${index}]」。`,
        action: '相同网址共享一个文末条目，保持文末简洁。',
        review: false,
        span: ctx.spanOf(node),
      })
    }

    return {
      ...node,
      type: 'wxLink',
      data: { ...(node.data ?? {}), wxLinkIndex: index, wxChannel: 'external' },
    }
  })

  if (replaced) root.children = childrenOf(replaced)
}
