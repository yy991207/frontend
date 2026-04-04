import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  ExportOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import chatConfigText from '../../../config.yaml?raw'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArtifactFileDetail } from '../../components/chat/artifact-file-detail'
import { ArtifactsProvider, useArtifacts } from '../../components/chat/artifacts-context'
import { MessageList } from '../../components/chat/message-list'
import { useStickToBottom } from '../../components/chat/use-stick-to-bottom'
import { AttachmentMenu, type AttachmentSkillItem } from '../../components/common/AttachmentMenu'
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal'
import { adaptChatMessages } from '../../core/messages/adapters'
import {
  advanceAssistantMessageForNextModelPhase,
  appendTextDeltaToStreamMessages,
} from '../../core/messages/streaming'
import type { LegacyChatMessage as ChatMessage } from '../../core/messages/types'
import { groupMessages, resolveAssistantCopyTargets } from '../../core/messages/utils'
import {
  createChatSession,
  downloadSessionFileContent,
  extractCourseTableFilePath,
  parseChatApiConfig,
  parseCourseTableContent,
  readSseStream,
  streamChatMessage,
  type ChatApiConfig,
  type CourseItem,
  type SkillOutputItem,
  type ToolCall,
} from '../../services/chatService'
import {
  createChatStreamBridge,
  type ChatStreamBridge,
  type StreamBridgeStatus,
} from '../../services/chatStreamBridgeService'
import { notifyChatSessionHistoryRefresh } from '../../services/chatSessionEvents'
import {
  deleteChatSession,
  getDefaultConfig,
  getChatSession,
  parseChatSessionConfig,
  type ChatSessionDetail,
  type ChatSessionConfig,
  type ChatSessionMessageToolCall,
} from '../../services/chatSessionService'
import {
  buildSkillDisplayName,
  buildSkillInitialPrompt,
  extractSkillItemsFromResponse,
  type SkillApiResponse,
} from '../../services/skillPromptService'
import styles from './chat.module.less'

type SkillItem = AttachmentSkillItem

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

// 一轮请求里可能出现“正文 -> 工具 -> 正文”的多段 assistant 输出，这里在工具步骤之后切出新的 assistant 消息，保留真实时间顺序。
function createFollowupAssistantMessage(baseMessage: ChatMessage, nextMessageId: string, timestamp: string): ChatMessage {
  return {
    ...baseMessage,
    id: nextMessageId,
    content: '',
    timestamp,
    loading: true,
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
  return parseCourseTableContent(rawContent)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function parseSimpleYaml(rawText: string) {
  return rawText.split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return result
    }

    const separatorIndex = trimmedLine.indexOf(':')

    if (separatorIndex === -1) {
      return result
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

    if (key) {
      result[key] = value
    }

    return result
  }, {})
}

function buildAbsoluteUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function loadChatSessionConfig(): Promise<ChatSessionConfig> {
  try {
    const response = await fetch('/config.yaml')
    if (response.ok) {
      const rawText = await response.text()
      return parseChatSessionConfig(rawText)
    }
  } catch {
    // ignore and fallback
  }

  return getDefaultConfig()
}

function mapToolCall(raw: ChatSessionMessageToolCall): ToolCall {
  return {
    name: raw.name,
    runId: raw.call_id,
    status: raw.status === 'completed' ? 'completed' : 'running',
    input: raw.input ?? {},
    output: raw.output,
    toolDisplay: raw.tool_display,
  }
}

function mapSessionDetailToMessages(session: ChatSessionDetail): ChatMessage[] {
  return session.messages.map((message) => {
    const rawSkillOutput = message.skill_output
    const skillOutput: SkillOutputItem[] = Array.isArray(rawSkillOutput)
      ? rawSkillOutput.filter(
          (item): item is SkillOutputItem =>
            typeof item === 'object' && item !== null && typeof (item as { url?: unknown }).url === 'string',
        )
      : []

    return {
      id: message.message_id,
      role: message.role,
      content: message.content,
      reasoningContent: message.reasoning_content ?? null,
      timestamp: formatTime(new Date(message.created_at)),
      sessionId: session.session_id,
      toolCalls: message.tool_calls.map(mapToolCall),
      references: message.references,
      skillOutput,
    }
  })
}

function parseSkillApiConfig(rawText: string) {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const managePath = parsedConfig.view_user_skills_path
  const listPath = parsedConfig.list_user_skills_path
  const userId = parsedConfig.user_id
  const userIdParam = parsedConfig.skill_user_id_param

  if (!baseUrl || !managePath || !userId || !userIdParam) {
    throw new Error('config.yaml 缺少 url、view_user_skills_path、user_id 或 skill_user_id_param 配置')
  }

  const managePathWithUser = managePath.includes('{user_id}')
    ? managePath.replace('{user_id}', encodeURIComponent(userId))
    : managePath

  const listEndpoint = listPath
    ? buildAbsoluteUrl(baseUrl, listPath)
    : null

  return {
    manageEndpoint: buildAbsoluteUrl(baseUrl, managePathWithUser),
    listEndpoint,
    userId,
    userIdParam,
  }
}

export default function ChatPage() {
  return (
    <ArtifactsProvider>
      <ChatPageContent />
    </ArtifactsProvider>
  )
}

function ChatPageContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamBridgeRef = useRef<ChatStreamBridge | null>(null)
  const streamBridgeStatusRef = useRef<StreamBridgeStatus | null>(null)
  const headerMenuRef = useRef<HTMLDivElement | null>(null)
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false)
  const [draft, setDraft] = useState('')
  const [preferredToolType, setPreferredToolType] = useState<string | null>(null)
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [selectedSkillDescription, setSelectedSkillDescription] = useState('')
  const [requestError, setRequestError] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const stickToBottom = useStickToBottom()
  const { containerRef: messagesViewportRef, scrollToBottom } = stickToBottom

  const clearSelectedSkill = () => {
    setPreferredToolType(null)
    setSelectedSkillName('')
    setSelectedSkillDescription('')
  }

  const chatApiConfig = useMemo<ChatApiConfig | null>(() => {
    try {
      return parseChatApiConfig(chatConfigText)
    } catch {
      return null
    }
  }, [])

  const skillApiConfig = useMemo(() => {
    try {
      return parseSkillApiConfig(chatConfigText)
    } catch {
      return null
    }
  }, [])

  const sessionBaseUrl = useMemo(() => {
    if (!chatApiConfig) return null
    try {
      const url = new URL(chatApiConfig.streamEndpointBase)
      return `${url.protocol}//${url.host}`
    } catch {
      return null
    }
  }, [chatApiConfig])

  const routeSessionId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('sessionId')
  }, [location.search])

  const initialPrompt = useMemo(() => {
    const value = location.state as { initialPrompt?: string; toolType?: string | null } | null
    return value?.initialPrompt?.trim() ?? ''
  }, [location.state])

  const initialToolType = useMemo(() => {
    const value = location.state as { initialPrompt?: string; toolType?: string | null } | null
    return value?.toolType ?? null
  }, [location.state])

  const initialConversation = useMemo(() => {
    if (!initialPrompt || routeSessionId) {
      return null
    }

    const now = new Date()
    return {
      userMessage: {
        id: `user-${now.getTime()}`,
        role: 'user' as const,
        content: initialPrompt,
        timestamp: formatTime(now),
      },
      loadingMessage: {
        id: `assistant-${now.getTime()}`,
        role: 'assistant' as const,
        content: '',
        timestamp: formatTime(now),
        loading: true,
      },
    }
  }, [initialPrompt, routeSessionId])

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialConversation ? [initialConversation.userMessage, initialConversation.loadingMessage] : [],
  )
  const messagesRef = useRef<ChatMessage[]>(messages)
  const [isResponding, setIsResponding] = useState(() => Boolean(initialConversation))
  const adaptedMessages = useMemo(() => adaptChatMessages(messages), [messages])
  const groupedMessages = useMemo(() => groupMessages(adaptedMessages), [adaptedMessages])
  // 当前这一轮回复结束前，先不显示它自己的复制按钮，避免流式过程中同一轮回答出现多个复制入口。
  const assistantCopyTargets = useMemo(
    () => resolveAssistantCopyTargets(adaptedMessages, { excludeLastTurn: isResponding }),
    [adaptedMessages, isResponding],
  )
  const currentSessionId = useMemo(() => {
    const messageSessionId = [...messages].reverse().find((message) => message.sessionId)?.sessionId
    return routeSessionId || messageSessionId || null
  }, [routeSessionId, messages])

  const { addFile, selectFile, open: artifactOpen } = useArtifacts()

  const handleOpenFile = useCallback((filepath: string, originalUrl?: string) => {
    if (!currentSessionId || !sessionBaseUrl) return
    const artifactFile = { filepath, sessionId: currentSessionId, baseUrl: sessionBaseUrl, originalUrl }
    addFile(artifactFile)
    selectFile(artifactFile)
  }, [currentSessionId, sessionBaseUrl, addFile, selectFile])

  const syncSessionToRoute = useCallback((sessionId: string) => {
    navigate(
      {
        pathname: location.pathname,
        search: `?sessionId=${sessionId}`,
      },
      { replace: true, state: null },
    )
  }, [location.pathname, navigate])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // 消息内容变化时自动滚动到底部（流式输出时内容在变化但消息数量不变）
  // 用户主动上滑查看历史消息时（isAtBottom 为 false），不抢滚动条
  useEffect(() => {
    requestAnimationFrame(() => {
      if (isResponding || sessionLoading || stickToBottom.isAtBottom) {
        scrollToBottom({ smooth: true, forceScroll: sessionLoading })
      }

      if (sessionLoading) {
        requestAnimationFrame(() => {
          scrollToBottom({ smooth: true, forceScroll: sessionLoading })
        })
      }
    })
  }, [messages, isResponding, scrollToBottom, sessionLoading, stickToBottom.isAtBottom])

  useEffect(() => {
    const streamBridge = createChatStreamBridge((snapshot) => {
      const previousStatus = streamBridgeStatusRef.current
      streamBridgeStatusRef.current = snapshot.status
      const nextMessages = snapshot.messages as ChatMessage[]
      messagesRef.current = nextMessages
      setMessages(nextMessages)
      setIsResponding(snapshot.status === 'streaming')
      setRequestError(snapshot.status === 'error' ? (snapshot.error ?? '请求失败，请稍后重试。') : '')

      if (snapshot.status === 'completed' && previousStatus !== 'completed') {
        notifyChatSessionHistoryRefresh(snapshot.sessionId)
      }
    })

    streamBridgeRef.current = streamBridge

    return () => {
      streamBridgeRef.current?.destroy()
      streamBridgeRef.current = null
    }
  }, [])

  // 获取用户技能列表（我添加的 + 我创建的）
  const fetchSkills = useCallback(async (signal?: AbortSignal) => {
    if (!skillApiConfig) {
      setSkills([])
      return
    }

    setSkillsLoading(true)

    try {
      const fetchAdded = async (): Promise<SkillItem[]> => {
        const requestUrl = new URL(skillApiConfig.manageEndpoint)
        requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)
        const response = await fetch(requestUrl.toString(), { signal })
        if (!response.ok) throw new Error('技能接口请求失败')
        const data = (await response.json()) as SkillApiResponse
        if (!data.success) throw new Error(data.msg || '技能接口返回失败')
        return extractSkillItemsFromResponse(data)
      }

      const fetchCreated = async (): Promise<SkillItem[]> => {
        if (!skillApiConfig.listEndpoint) return []
        const requestUrl = new URL(skillApiConfig.listEndpoint)
        requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)
        const response = await fetch(requestUrl.toString(), { signal })
        if (!response.ok) throw new Error('我创建的技能接口请求失败')
        const data = (await response.json()) as SkillApiResponse
        if (!data.success) throw new Error(data.msg || '我创建的技能接口返回失败')
        return extractSkillItemsFromResponse(data)
      }

      const [addedSkills, createdSkills] = await Promise.all([fetchAdded(), fetchCreated()])
      const seen = new Set<string>()
      const merged: SkillItem[] = []
      for (const skill of [...addedSkills, ...createdSkills]) {
        if (!seen.has(skill.id)) {
          seen.add(skill.id)
          merged.push(skill)
        }
      }
      setSkills(merged)
    } catch {
      if (!signal?.aborted) {
        setSkills([])
      }
    } finally {
      if (!signal?.aborted) {
        setSkillsLoading(false)
      }
    }
  }, [skillApiConfig])

  const runAssistantReply = async (
    prompt: string,
    userMessage: ChatMessage,
    loadingMessage: ChatMessage,
    baseMessages: ChatMessage[],
    toolType: string | null = null,
  ) => {
    if (!chatApiConfig) {
      setRequestError('聊天配置读取失败，请检查 config.yaml')
      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        prev.map((item) =>
          item.id === loadingMessage.id
            ? {
                ...item,
                content: '聊天配置读取失败，请检查 config.yaml',
                timestamp: replyTime,
                loading: false,
              }
            : item,
        ),
      )
      setIsResponding(false)
      return
    }
    setRequestError('')

    const controller = new AbortController()
    abortControllerRef.current = controller
    let usingSharedBridge = false
    let activeAssistantMessageId = loadingMessage.id

    try {
      let sessionId = currentSessionId

      // 会话一旦创建成功，就必须复用同一个 sessionId，避免刷新或继续追问时被拆成新会话。
      if (!sessionId) {
        const createdSession = await createChatSession(chatApiConfig, controller.signal)
        sessionId = createdSession.sessionId
      }

      const nextMessages = baseMessages.map((item) =>
        item.id === userMessage.id || item.id === loadingMessage.id
          ? {
              ...item,
              sessionId,
            }
          : item,
      )

      messagesRef.current = nextMessages
      setMessages(nextMessages)
      syncSessionToRoute(sessionId)

      const streamBridge = streamBridgeRef.current

      if (streamBridge) {
        await streamBridge.startStream({
          sessionId,
          config: chatApiConfig,
          payload: {
            message: prompt,
            tool_type: toolType,
          },
          messages: nextMessages,
          loadingMessageId: loadingMessage.id,
        })
        usingSharedBridge = true
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        return
      }

      const stream = await streamChatMessage(
        chatApiConfig,
        sessionId,
        {
          message: prompt,
          tool_type: toolType,
        },
        controller.signal,
      )

      await readSseStream(stream, {
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
            return result.messages
          })
        },
        onReasoningDelta(chunk) {
          setMessages((prev) =>
            updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
              ...message,
              reasoningContent: `${message.reasoningContent ?? ''}${chunk}`,
            })),
          )
        },
        onToolStart(toolCall) {
          const toolMessageId = activeAssistantMessageId

          setMessages((prev) =>
            updateAssistantMessageById(prev, toolMessageId, (message) => upsertToolCall(message, toolCall)),
          )
        },
        onToolEnd(toolCall) {
          const toolMessageId = activeAssistantMessageId

          void loadCourseTable(chatApiConfig, sessionId, toolCall, controller.signal)
            .then((courses) => {
              if (!courses.length) {
                return
              }

              setMessages((prev) =>
                updateAssistantMessageById(prev, toolMessageId, (message) => ({
                  ...upsertToolCall(message, toolCall),
                  courses,
                })),
              )
            })
            .catch(() => {
              // 课程文件下载失败时保持普通工具卡展示，不阻断主回答。
            })

          setMessages((prev) =>
            updateAssistantMessageById(prev, toolMessageId, (message) => upsertToolCall(message, toolCall)),
          )
        },
        onReferences(references) {
          setMessages((prev) =>
            updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
              ...message,
              references,
            })),
          )
        },
        onSkillOutput(skillOutput) {
          setMessages((prev) =>
            updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
              ...message,
              skillOutput,
            })),
          )
        },
      })

      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
          ...message,
          timestamp: replyTime,
          loading: false,
        })),
      )
      notifyChatSessionHistoryRefresh(sessionId)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
          ...message,
          content: message.content || '请求失败，请稍后重试。',
          timestamp: replyTime,
          loading: false,
        })),
      )
      setRequestError(error instanceof Error ? error.message : '请求失败，请稍后重试。')
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }

      if (!usingSharedBridge) {
        setIsResponding(false)
      }
    }
  }

  const startAssistantReply = async (prompt: string, toolType: string | null = null) => {
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

    const nextMessages = [...messagesRef.current, userMessage, loadingMessage]
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    setIsResponding(true)

    await runAssistantReply(prompt, userMessage, loadingMessage, nextMessages, toolType)
  }

  useEffect(() => {
    if (!initialConversation || routeSessionId) {
      return
    }

    setRequestError('')
    void runAssistantReply(
      initialPrompt,
      initialConversation.userMessage,
      initialConversation.loadingMessage,
      [initialConversation.userMessage, initialConversation.loadingMessage],
      initialToolType,
    )

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [initialConversation, initialPrompt, initialToolType, routeSessionId])

  useEffect(() => {
    if (!routeSessionId) {
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

      setSessionLoading(true)

      const streamBridge = streamBridgeRef.current

      if (streamBridge) {
        // 刷新后优先尝试从共享流快照恢复，避免正在返回的 stream 被页面状态重置打断展示。
        const snapshot = await streamBridge.subscribe(routeSessionId)

        if (cancelled) {
          return
        }

        if (snapshot) {
          const nextMessages = snapshot.messages as ChatMessage[]
          messagesRef.current = nextMessages
          setMessages(nextMessages)
          setIsResponding(snapshot.status === 'streaming')
          setRequestError(snapshot.status === 'error' ? (snapshot.error ?? '请求失败，请稍后重试。') : '')
          setSessionLoading(false)
          return
        }
      }

      controller = new AbortController()

      try {
        const config = await loadChatSessionConfig()
        const session = await getChatSession(config, routeSessionId, controller.signal)

        if (cancelled) {
          return
        }

        const nextMessages = mapSessionDetailToMessages(session)
        messagesRef.current = nextMessages
        setMessages(nextMessages)
        setIsResponding(false)
        setRequestError('')
        setSessionLoading(false)
      } catch (error) {
        if (!controller.signal.aborted && !cancelled) {
          setRequestError(error instanceof Error ? error.message : '获取会话详情失败')
          setSessionLoading(false)
        }
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
      setSessionLoading(false)
      streamBridgeRef.current?.unsubscribe(routeSessionId)
      controller?.abort()
    }
  }, [routeSessionId])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!headerMenuRef.current?.contains(event.target as Node)) {
        setHeaderMenuOpen(false)
      }
    }

    if (headerMenuOpen) {
      document.addEventListener('mousedown', handlePointerDown)
    }

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [headerMenuOpen])

  const handleSend = () => {
    const value = draft.trim()
    if (!value || isResponding) return

    const outgoingPrompt = selectedSkillName
      ? buildSkillInitialPrompt({
          skillName: selectedSkillName,
          template: value,
          title: selectedSkillName,
        })
      : value
    const outgoingToolType = selectedSkillName ? preferredToolType || selectedSkillName : null

    setDraft('')
    clearSelectedSkill()
    void startAssistantReply(outgoingPrompt, outgoingToolType)
  }

  // 跳转到技能管理页面
  const handleManageSkills = () => {
    navigate('/skills', {
      state: {
        mode: 'manage',
      },
    })
  }

  // 选择技能后先进入输入态，和技能管理页“使用”保持一致。
  const handleSelectSkill = (skill: SkillItem) => {
    // 加号选择技能后先进入输入态，用户还能继续补充模板参数，再统一发送。
    setSelectedSkillName(skill.skillName || skill.id)
    setSelectedSkillDescription(skill.description)
    setPreferredToolType(skill.skillName || skill.id)
    setDraft(skill.template)
  }

  const handleStop = () => {
    if (currentSessionId && streamBridgeRef.current?.stopStream(currentSessionId)) {
      setMessages((prev) =>
        prev.map((item) =>
          item.loading
            ? {
                ...item,
                loading: false,
              }
            : item,
        ),
      )
      setIsResponding(false)
      return
    }

    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setMessages((prev) =>
      prev.map((item) =>
        item.loading
          ? {
              ...item,
              loading: false,
            }
          : item,
      ),
    )
    setIsResponding(false)
  }

  const handleCopy = async (messageId: string, content: string) => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current))
      }, 2000)
    } catch {
      // 复制失败时不额外打断页面交互。
    }
  }

  const handleDeleteCurrentSession = async () => {
    if (!currentSessionId) {
      return
    }

    try {
      setDeleteLoading(true)
      const config = await loadChatSessionConfig()
      await deleteChatSession(config, currentSessionId)
      setDeleteConfirmOpen(false)
      setHeaderMenuOpen(false)
      navigate('/')
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '删除会话失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.splitContainer} ${artifactOpen ? styles.splitContainerOpen : ''}`}>
        <section className={styles.panel}>
          <header className={styles.header}>
            <h1 className={styles.title}>问候</h1>
            <div className={styles.headerActions}>
              <button type="button" className={styles.headerButton} aria-label="分享">
                <ExportOutlined />
              </button>
              <button type="button" className={styles.headerButton} aria-label="文件夹">
                <FolderOpenOutlined />
              </button>
              <div ref={headerMenuRef} className={styles.headerMenuContainer}>
                <button
                  type="button"
                  className={styles.headerButton}
                  aria-label="更多"
                  onClick={() => setHeaderMenuOpen((value) => !value)}
                >
                  <EllipsisOutlined />
                </button>
                {headerMenuOpen ? (
                  <div className={styles.headerMenuDropdown}>
                    <button
                      type="button"
                      className={styles.headerMenuItem}
                      onClick={() => {
                        setDeleteConfirmOpen(true)
                        setHeaderMenuOpen(false)
                      }}
                    >
                      <DeleteOutlined className={styles.headerMenuItemIcon} />
                      <span>删除当前会话</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div ref={messagesViewportRef} className={styles.messages}>
            <div className={styles.messageColumn}>
              <MessageList
                groups={groupedMessages}
                threadLoading={sessionLoading}
                copiedMessageId={copiedMessageId}
                assistantCopyTargets={assistantCopyTargets}
                onCopy={handleCopy}
                getToolDisplayTitle={getToolDisplayTitle}
                getToolDisplaySummary={getToolDisplaySummary}
                onOpenFile={handleOpenFile}
              />
            </div>
          </div>

          <div className={styles.composerArea}>
            <div className={styles.composerWrap}>
              <div className={styles.composer}>
                <AttachmentMenu
                  placement="top"
                  skills={skills}
                  skillsLoading={skillsLoading}
                  loadSkills={fetchSkills}
                  onSelectSkill={handleSelectSkill}
                  onManageSkills={handleManageSkills}
                  showTools
                  webSearchEnabled={webSearchEnabled}
                  knowledgeEnabled={knowledgeEnabled}
                  onToggleWebSearch={() => setWebSearchEnabled((value) => !value)}
                  onToggleKnowledge={() => setKnowledgeEnabled((value) => !value)}
                />
                {selectedSkillName ? <span className={styles.skillPrefix}>基于</span> : null}
                {selectedSkillName ? (
                  <span className={styles.skillTagWrap}>
                    <span className={styles.skillNameTag}>{buildSkillDisplayName(selectedSkillName)}</span>
                    <button
                      type="button"
                      className={styles.skillRemoveButton}
                      aria-label="移除已选技能"
                      onClick={clearSelectedSkill}
                    >
                      <CloseOutlined />
                    </button>
                    {selectedSkillDescription ? (
                      <span className={styles.skillDescriptionTooltip}>{selectedSkillDescription}</span>
                    ) : null}
                  </span>
                ) : null}
                <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                            return
                          }

                          if (event.key === 'Backspace' && !draft.trim() && selectedSkillName) {
                            event.preventDefault()
                            clearSelectedSkill()
                            return
                          }

                          if (event.key === 'Enter') {
                            event.preventDefault()
                            handleSend()
                    }
                  }}
                  className={styles.composerInput}
                  placeholder="下一步要做什么？"
                />
                <button type="button" className={styles.iconButton} aria-label="语音输入">
                  <AudioOutlined />
                </button>
                {isResponding ? (
                  <button type="button" className={`${styles.circleButton} ${styles.stopButton}`} onClick={handleStop}>
                    <span className={styles.stopInner} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.circleButton} ${styles.sendButton} ${!draft.trim() ? styles.sendButtonDisabled : ''}`}
                    onClick={handleSend}
                    disabled={!draft.trim()}
                  >
                    <ArrowUpOutlined />
                  </button>
                )}
              </div>
            </div>
            <div className={styles.footerHint}>{requestError || 'AI 生成内容可能有误，请核实重要信息'}</div>
          </div>
        </section>
        <section className={`${styles.artifactPanel} ${artifactOpen ? styles.artifactPanelOpen : styles.artifactPanelClosed}`}>
          <ChatArtifactPanel />
        </section>
      </div>
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        title="删除当前会话"
        description="确认删除后将无法恢复，是否继续？"
        loading={deleteLoading}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteCurrentSession}
      />
    </main>
  )
}

function ChatArtifactPanel() {
  const { selectedFile, open } = useArtifacts()

  if (!selectedFile || !open) return null

  return <ArtifactFileDetail file={selectedFile} />
}
