import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ScrollToBottomOptions = {
  smooth?: boolean
  forceScroll?: boolean
}

export function useStickToBottom(threshold = 24) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollToBottom = useCallback(({ smooth = false, forceScroll = false }: ScrollToBottomOptions = {}) => {
    const container = containerRef.current

    if (!container) {
      return
    }

    // 用户主动上滑查看历史消息时，不抢滚动条；只有新会话加载这类场景才强制贴底。
    if (!isAtBottom && !forceScroll) {
      return
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [isAtBottom])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const handleScroll = () => {
      const distanceToBottom = Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop)
      setIsAtBottom(distanceToBottom <= threshold)
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [threshold])

  return useMemo(() => ({
    containerRef,
    scrollToBottom,
    isAtBottom,
  }), [isAtBottom, scrollToBottom])
}
