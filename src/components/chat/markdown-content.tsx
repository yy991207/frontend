import type { HTMLAttributes } from 'react'
import { Streamdown } from 'streamdown'
import 'katex/dist/katex.min.css'
import 'streamdown/styles.css'

import {
  streamdownPlugins,
  streamdownPluginsWithWordAnimation,
} from '../../core/streamdown/plugins'

type MarkdownContentProps = HTMLAttributes<HTMLDivElement> & {
  content: string
  isStreaming?: boolean
}

/**
 * Markdown 内容渲染组件
 * 参考 deer-flow 实现，使用 Streamdown 直接渲染
 */
export function MarkdownContent({
  content,
  isStreaming = false,
  className,
  ...props
}: MarkdownContentProps) {
  const plugins = isStreaming ? streamdownPluginsWithWordAnimation : streamdownPlugins

  return (
    <div className={className} {...props}>
      <Streamdown
        mode={isStreaming ? 'streaming' : 'static'}
        isAnimating={isStreaming}
        parseIncompleteMarkdown
        remarkPlugins={plugins.remarkPlugins}
        rehypePlugins={plugins.rehypePlugins}
        lineNumbers={false}
        controls={false}
      >
        {content}
      </Streamdown>
    </div>
  )
}
