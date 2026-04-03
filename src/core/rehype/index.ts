import type { Element, ElementContent, Root } from 'hast'
import { visit } from 'unist-util-visit'

const ANIMATABLE_TAGS = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'blockquote'])

function splitTextIntoSegments(text: string): string[] {
  if (!text) {
    return []
  }

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('zh', { granularity: 'word' })
    return Array.from(segmenter.segment(text), (segment) => segment.segment)
  }

  return text.split(/(\s+)/).filter((segment) => segment.length > 0)
}

function isElementNode(node: ElementContent): node is Element {
  return node.type === 'element'
}

/**
 * 这里把文本拆成独立 span，后面流式返回时就能只对新增文字做轻量动画。
 */
export function rehypeSplitWordsIntoSpans() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (!ANIMATABLE_TAGS.has(node.tagName) || !Array.isArray(node.children)) {
        return
      }

      const nextChildren: ElementContent[] = []

      for (const child of node.children) {
        if (!isElementNode(child) && child.type === 'text') {
          const segments = splitTextIntoSegments(child.value)

          if (!segments.length) {
            nextChildren.push(child)
            continue
          }

          for (const segment of segments) {
            nextChildren.push({
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['stream-word'],
              },
              children: [{ type: 'text', value: segment }],
            })
          }

          continue
        }

        nextChildren.push(child)
      }

      node.children = nextChildren
    })
  }
}
