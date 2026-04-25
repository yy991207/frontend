import { message } from 'antd'
import { useEffect, useRef, useState } from 'react'

export function useFileContent(
  loadContent: (signal: AbortSignal) => Promise<string>,
  enabled: boolean,
  deps: unknown[] = [],
): { content: string; loading: boolean } {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort()
      setContent('')
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)

    loadContent(controller.signal)
      .then((text) => {
        if (!controller.signal.aborted) {
          setContent(text)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          message.error('文件内容加载失败')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return { content, loading }
}
