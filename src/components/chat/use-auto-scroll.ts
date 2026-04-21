import { useEffect, useMemo } from 'react'
import { useStickToBottom } from './use-stick-to-bottom'

type UseAutoScrollProps = {
  messages: unknown[]
  isResponding: boolean
  sessionLoading: boolean
}

export function useAutoScroll({ messages, isResponding, sessionLoading }: UseAutoScrollProps) {
  const stickToBottom = useStickToBottom()
  const { containerRef, scrollToBottom, isAtBottom } = stickToBottom

  // 消息内容变化时自动滚动到底部（流式输出时内容在变化但消息数量不变）
  // 用户主动上滑查看历史消息时（isAtBottom 为 false），不抢滚动条
  useEffect(() => {
    requestAnimationFrame(() => {
      if (isResponding || sessionLoading || isAtBottom) {
        scrollToBottom({ smooth: true, forceScroll: sessionLoading })
      }

      if (sessionLoading) {
        requestAnimationFrame(() => {
          scrollToBottom({ smooth: true, forceScroll: sessionLoading })
        })
      }
    })
  }, [messages, isResponding, sessionLoading, scrollToBottom, isAtBottom])

  return useMemo(() => ({
    containerRef,
    scrollToBottom,
    isAtBottom,
  }), [containerRef, scrollToBottom, isAtBottom])
}
