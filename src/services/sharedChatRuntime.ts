import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adaptChatMessages } from '../core/messages/adapters'
import {
  advanceAssistantMessageForNextModelPhase,
  appendTextDeltaToStreamMessages,
} from '../core/messages/streaming'
import type { LegacyChatMessage as ChatMessage } from '../core/messages/types'
import { groupMessages, resolveAssistantCopyTargets } from '../core/messages/utils'
import {
  createChatSession,
  downloadSessionFileContent,
  extractCourseTableFilePath,
  readSseStream,
  resumeChatMessageStream,
  streamChatMessage,
  type ChatApiConfig,
  type CourseItem,
  type ToolCall,
} from './chatService'
import {
  createChatStreamBridge,
  type ChatStreamBridge,
  type StreamBridgeSnapshot,
  type StreamBridgeStatus,
} from './chatStreamBridgeService'
import {
  clearChatStreamSnapshot,
  loadChatStreamSnapshot,
  persistChatStreamSnapshot,
} from './chatStreamSnapshotStore'

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function getToolDisplayTitle(toolCall: ToolCall) {
  const label = typeof toolCall.toolDisplay?.tool_label === 'string' ? toolCall.toolDisplay.tool_label : ''
  return label || toolCall.name
}

function getToolDisplaySummary(toolCall: ToolCall) {
  const items = Array.isArray(toolCall.toolDisplay?.items) ? toolCall.toolDisplay.items : []

  if (toolCall.status === 'running') {
    return '工具执行中...'
  }

  if (items.length > 0) {
    return `已返回 ${items.length} 条结果`
  }

  return '工具执行完成'
}

function upsertToolCall(message: ChatMessage, nextToolCall: ToolCall): ChatMessage {
  const toolCalls = message.toolCalls ?? []
  const existingToolCall = toolCalls.find((item) => item.runId === nextToolCall.runId)

  if (!existingToolCall) {
    return {
      ...message,
      toolCalls: [...toolCalls, nextToolCall],
    }
  }

  return {
    ...message,
    toolCalls: toolCalls.map((item) =>
      item.runId === nextToolCall.runId
        ? {
            ...item,
            ...nextToolCall,
            input: Object.keys(nextToolCall.input).length ? nextToolCall.input : item.input,
          }
        : item,
    ),
  }
}

function updateAssistantMessageById(
  messages: ChatMessage[],
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === messageId
      ? updater(message)
      : message,
  )
}

function createFollowupAssistantMessage(baseMessage: ChatMessage, nextMessageId: string, timestamp: string): ChatMessage {
  return {
    ...baseMessage,
    id: nextMessageId,
    content: '',
    timestamp,
    loading: true,
    reasoningContent: null,
    toolCalls: [],
    references: [],
    courses: [],
    skillOutput: [],
  }
}

async function loadCourseTable(
  chatApiConfig: ChatApiConfig,
  sessionId: string,
  toolCall: ToolCall,
  signal: AbortSignal,
): Promise<CourseItem[]> {
  const filePath = extractCourseTableFilePath(toolCall)

  if (!filePath) {
    return []
  }

  const rawContent = await downloadSessionFileContent(chatApiConfig, sessionId, filePath, signal)
  void rawContent
  return []
}

function parseLastEventSequence(eventId: string) {
  const parsedSequence = Number.parseInt(eventId, 10)
  return Number.isFinite(parsedSequence) ? parsedSequence : null
}

function resolveActiveStreamingMessageId(messages: ChatMessage[], fallbackMessageId: string) {
  const loadingAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.loading)

  if (loadingAssistant) {
    return loadingAssistant.id
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  return lastAssistant?.id ?? fallbackMessageId
}

function applyStreamSnapshot(
  snapshot: StreamBridgeSnapshot,
  actions: {
    messagesRef: { current: ChatMessage[] }
    setMessages: (messages: ChatMessage[]) => void
    setIsResponding: (value: boolean) => void
    setRequestError: (value: string) => void
  },
) {
  const nextMessages = snapshot.messages as ChatMessage[]
  actions.messagesRef.current = nextMessages
  actions.setMessages(nextMessages)
  actions.setIsResponding(snapshot.status === 'streaming')
  actions.setRequestError(snapshot.status === 'error' ? (snapshot.error ?? '请求失败，请稍后重试。') : '')
}

type UseSharedChatRuntimeOptions = {
  chatApiConfig: ChatApiConfig | null
  sessionId: string | null
  routeSessionId?: string | null
  setSessionId: (sessionId: string) => void
  enableWebSearch?: boolean
}

export function useSharedChatRuntime({
  chatApiConfig,
  sessionId,
  routeSessionId = null,
  setSessionId,
  enableWebSearch = true,
}: UseSharedChatRuntimeOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const messagesRef = useRef<ChatMessage[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamBridgeRef = useRef<ChatStreamBridge | null>(null)
  const streamBridgeStatusRef = useRef<StreamBridgeStatus | null>(null)

  const adaptedMessages = useMemo(() => adaptChatMessages(messages), [messages])
  const groupedMessages = useMemo(() => groupMessages(adaptedMessages), [adaptedMessages])
  const assistantCopyTargets = useMemo(
    () => resolveAssistantCopyTargets(adaptedMessages, { excludeLastTurn: isResponding }),
    [adaptedMessages, isResponding],
  )

  useEffect(() => {
    const streamBridge = createChatStreamBridge((snapshot) => {
      const previousStatus = streamBridgeStatusRef.current
      streamBridgeStatusRef.current = snapshot.status

      if (snapshot.status === 'streaming') {
        persistChatStreamSnapshot(snapshot)
      } else {
        clearChatStreamSnapshot(snapshot.sessionId)
      }

      applyStreamSnapshot(snapshot, {
        messagesRef,
        setMessages,
        setIsResponding,
        setRequestError,
      })

      void previousStatus
    })

    streamBridgeRef.current = streamBridge

    return () => {
      streamBridgeRef.current?.destroy()
      streamBridgeRef.current = null
    }
  }, [])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!routeSessionId || !chatApiConfig) {
      setSessionLoading(false)
      return
    }

    let cancelled = false
    let controller: AbortController | null = null

    const restoreSession = async () => {
      const hasCurrentSessionMessages = messagesRef.current.some((message) => message.sessionId === routeSessionId)

      if (hasCurrentSessionMessages) {
        setSessionLoading(false)
        return
      }

      const cachedSnapshot = loadChatStreamSnapshot(routeSessionId)

      if (cachedSnapshot) {
        applyStreamSnapshot(cachedSnapshot, {
          messagesRef,
          setMessages,
          setIsResponding,
          setRequestError,
        })
      }

      setSessionLoading(true)

      const streamBridge = streamBridgeRef.current
      if (streamBridge) {
        const snapshot = await streamBridge.subscribe(routeSessionId)

        if (cancelled) {
          return
        }

        if (snapshot) {
          applyStreamSnapshot(snapshot, {
            messagesRef,
            setMessages,
            setIsResponding,
            setRequestError,
          })
          setSessionLoading(false)
          return
        }

        if (cachedSnapshot?.status === 'streaming') {
          await streamBridge.resumeStream({
            sessionId: routeSessionId,
            config: chatApiConfig,
            snapshot: cachedSnapshot,
            afterSequence: cachedSnapshot.lastEventSequence,
          })
          if (!cancelled) {
            setSessionLoading(false)
          }
          return
        }
      }

      controller = new AbortController()
      const restoreController = controller

      if (cachedSnapshot?.status === 'streaming') {
        let activeAssistantMessageId =
          cachedSnapshot.activeMessageId ||
          resolveActiveStreamingMessageId(cachedSnapshot.messages as ChatMessage[], routeSessionId)
        let lastEventSequence = cachedSnapshot.lastEventSequence

        const persistDirectStreamSnapshot = (nextMessages: ChatMessage[]) => {
          persistChatStreamSnapshot({
            sessionId: routeSessionId,
            messages: nextMessages,
            status: 'streaming',
            activeMessageId: activeAssistantMessageId,
            lastEventSequence,
          })
        }

        try {
          const stream = await resumeChatMessageStream(
            chatApiConfig,
            routeSessionId,
            cachedSnapshot.lastEventSequence,
            restoreController.signal,
          )

          if (cancelled) {
            return
          }

          setSessionLoading(false)
          setRequestError('')

          await readSseStream(stream, {
            onEventId(eventId) {
              const nextSequence = parseLastEventSequence(eventId)
              if (nextSequence === null) return
              lastEventSequence = nextSequence
              persistDirectStreamSnapshot(messagesRef.current)
            },
            onChatModelStart() {
              const replyTime = formatTime(new Date())
              setMessages((prev) => {
                const result = advanceAssistantMessageForNextModelPhase(
                  prev,
                  activeAssistantMessageId,
                  replyTime,
                  createFollowupAssistantMessage,
                )
                activeAssistantMessageId = result.activeMessageId
                messagesRef.current = result.messages
                persistDirectStreamSnapshot(result.messages)
                return result.messages
              })
            },
            onTextDelta(chunk) {
              const replyTime = formatTime(new Date())
              setMessages((prev) => {
                const result = appendTextDeltaToStreamMessages(
                  prev,
                  activeAssistantMessageId,
                  chunk,
                  replyTime,
                  createFollowupAssistantMessage,
                )
                activeAssistantMessageId = result.activeMessageId
                messagesRef.current = result.messages
                persistDirectStreamSnapshot(result.messages)
                return result.messages
              })
            },
          })

          if (cancelled || restoreController.signal.aborted) {
            return
          }

          const replyTime = formatTime(new Date())
          setMessages((prev) => {
            const nextMessages = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
              ...message,
              timestamp: replyTime,
              loading: false,
            }))
            messagesRef.current = nextMessages
            return nextMessages
          })
          clearChatStreamSnapshot(routeSessionId)
          setIsResponding(false)
          return
        } catch {
          if (restoreController.signal.aborted || cancelled) {
            return
          }
        }
      }

      setSessionLoading(false)
    }

    void restoreSession()

    return () => {
      cancelled = true
      setSessionLoading(false)
      streamBridgeRef.current?.unsubscribe(routeSessionId)
      controller?.abort()
    }
  }, [chatApiConfig, routeSessionId])

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopiedMessageId(messageId)
    window.setTimeout(() => setCopiedMessageId((current) => (current === messageId ? null : current)), 1200)
  }, [])

  const startAssistantReply = useCallback(async (prompt: string) => {
    if (!chatApiConfig) {
      setRequestError('聊天配置读取失败，请检查 config.yaml')
      return
    }

    const now = new Date()
    const userMessage: ChatMessage = {
      id: `user-${now.getTime()}`,
      role: 'user',
      content: prompt,
      timestamp: formatTime(now),
    }
    const loadingMessage: ChatMessage = {
      id: `assistant-${now.getTime()}`,
      role: 'assistant',
      content: '',
      timestamp: formatTime(now),
      loading: true,
    }

    let nextMessages = [...messagesRef.current, userMessage, loadingMessage]
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    setIsResponding(true)
    setRequestError('')

    const controller = new AbortController()
    abortControllerRef.current = controller
    let activeAssistantMessageId = loadingMessage.id

    try {
      let resolvedSessionId = sessionId
      if (!resolvedSessionId) {
        const createdSession = await createChatSession(chatApiConfig, controller.signal)
        resolvedSessionId = createdSession.sessionId
        setSessionId(resolvedSessionId)
      }

      if (!resolvedSessionId) {
        throw new Error('会话创建失败')
      }

      nextMessages = nextMessages.map((item) =>
        item.id === userMessage.id || item.id === loadingMessage.id
          ? { ...item, sessionId: resolvedSessionId }
          : item,
      )
      messagesRef.current = nextMessages
      setMessages(nextMessages)

      let lastEventSequence = 0
      const persistDirectStreamSnapshot = (latestMessages: ChatMessage[]) => {
        persistChatStreamSnapshot({
          sessionId: resolvedSessionId,
          messages: latestMessages,
          status: 'streaming',
          activeMessageId: activeAssistantMessageId,
          lastEventSequence,
        })
      }

      const stream = await streamChatMessage(
        chatApiConfig,
        resolvedSessionId,
        {
          message: prompt,
          enable_web_search: enableWebSearch,
          include_tool_details: true,
        },
        controller.signal,
      )

      await readSseStream(stream, {
        onEventId(eventId) {
          const nextSequence = parseLastEventSequence(eventId)
          if (nextSequence === null) return
          lastEventSequence = nextSequence
          persistDirectStreamSnapshot(messagesRef.current)
        },
        onChatModelStart() {
          const replyTime = formatTime(new Date())
          setMessages((prev) => {
            const result = advanceAssistantMessageForNextModelPhase(
              prev,
              activeAssistantMessageId,
              replyTime,
              createFollowupAssistantMessage,
            )
            activeAssistantMessageId = result.activeMessageId
            messagesRef.current = result.messages
            persistDirectStreamSnapshot(result.messages)
            return result.messages
          })
        },
        onTextDelta(chunk) {
          const replyTime = formatTime(new Date())
          setMessages((prev) => {
            const result = appendTextDeltaToStreamMessages(
              prev,
              activeAssistantMessageId,
              chunk,
              replyTime,
              createFollowupAssistantMessage,
            )
            activeAssistantMessageId = result.activeMessageId
            messagesRef.current = result.messages
            persistDirectStreamSnapshot(result.messages)
            return result.messages
          })
        },
        onReasoningDelta(chunk) {
          setMessages((prev) => {
            const nextValue = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
              ...message,
              reasoningContent: `${message.reasoningContent ?? ''}${chunk}`,
            }))
            messagesRef.current = nextValue
            persistDirectStreamSnapshot(nextValue)
            return nextValue
          })
        },
        onToolStart(toolCall) {
          const toolMessageId = activeAssistantMessageId
          setMessages((prev) => {
            const nextValue = updateAssistantMessageById(prev, toolMessageId, (message) => upsertToolCall(message, toolCall))
            messagesRef.current = nextValue
            persistDirectStreamSnapshot(nextValue)
            return nextValue
          })
        },
        onToolEnd(toolCall) {
          const toolMessageId = activeAssistantMessageId
          void loadCourseTable(chatApiConfig, resolvedSessionId, toolCall, controller.signal)
          setMessages((prev) => {
            const nextValue = updateAssistantMessageById(prev, toolMessageId, (message) => upsertToolCall(message, toolCall))
            messagesRef.current = nextValue
            persistDirectStreamSnapshot(nextValue)
            return nextValue
          })
        },
        onReferences(references) {
          setMessages((prev) => {
            const nextValue = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
              ...message,
              references,
            }))
            messagesRef.current = nextValue
            persistDirectStreamSnapshot(nextValue)
            return nextValue
          })
        },
        onSkillOutput(skillOutput) {
          setMessages((prev) => {
            const nextValue = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
              ...message,
              skillOutput,
            }))
            messagesRef.current = nextValue
            persistDirectStreamSnapshot(nextValue)
            return nextValue
          })
        },
      })

      const replyTime = formatTime(new Date())
      setMessages((prev) => {
        const nextValue = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
          ...message,
          timestamp: replyTime,
          loading: false,
        }))
        messagesRef.current = nextValue
        return nextValue
      })
      clearChatStreamSnapshot(resolvedSessionId)
    } catch (error) {
      if (!controller.signal.aborted) {
        const replyTime = formatTime(new Date())
        setMessages((prev) => {
          const nextValue = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
            ...message,
            content: message.content || '请求失败，请稍后重试。',
            timestamp: replyTime,
            loading: false,
          }))
          messagesRef.current = nextValue
          return nextValue
        })
        if (sessionId) {
          clearChatStreamSnapshot(sessionId)
        }
        setRequestError(error instanceof Error ? error.message : '请求失败，请稍后重试。')
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      setIsResponding(false)
    }
  }, [chatApiConfig, enableWebSearch, sessionId, setSessionId])

  const handleSend = useCallback(() => {
    const value = draft.trim()
    if (!value || isResponding) return
    setDraft('')
    void startAssistantReply(value)
  }, [draft, isResponding, startAssistantReply])

  return {
    draft,
    setDraft,
    messages,
    groupedMessages,
    assistantCopyTargets,
    copiedMessageId,
    handleCopy,
    handleSend,
    isResponding,
    requestError,
    sessionLoading,
    getToolDisplayTitle,
    getToolDisplaySummary,
  }
}
