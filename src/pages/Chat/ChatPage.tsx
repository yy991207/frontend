import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { message } from 'antd'
import {
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
import { type AttachmentSkillItem } from '../../components/common/AttachmentMenu'
import { ChatComposer } from '../../components/common/ChatComposer'
import {
  createPendingUploadedFile,
  type UploadedFile,
  isAllowedFileType,
  ALLOWED_FILE_EXTENSIONS,
} from '../../services/ossUploadService'
import { uploadPendingFileToOssWithDocumentParse } from '../../services/agentFileUploadService'
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
  resumeChatMessageStream,
  streamChatMessage,
  type ChatApiConfig,
  type CourseItem,
  type SkillOutputItem,
  type ToolCall,
} from '../../services/chatService'
import {
  createChatStreamBridge,
  type ChatStreamBridge,
  type StreamBridgeSnapshot,
  type StreamBridgeStatus,
} from '../../services/chatStreamBridgeService'
import {
  clearChatStreamSnapshot,
  loadChatStreamSnapshot,
  persistChatStreamSnapshot,
} from '../../services/chatStreamSnapshotStore'
import { notifyChatSessionHistoryRefresh } from '../../services/chatSessionEvents'
import {
  deleteChatSession,
  findLatestEmptySession,
  getDefaultConfig,
  getChatSession,
  parseChatSessionConfig,
  type ChatSessionDetail,
  type ChatSessionConfig,
  type ChatSessionMessageToolCall,
} from '../../services/chatSessionService'
import {
  loadCustomAgentApiConfig,
  viewCustomAgent,
  type EnabledSkill,
} from '../../services/customAgentService'
import {
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
  return parseCourseTableContent(rawContent)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
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

function resolveActiveStreamingMessageId(messages: ChatMessage[], fallbackMessageId: string) {
  const loadingAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.loading)

  if (loadingAssistant) {
    return loadingAssistant.id
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  return lastAssistant?.id ?? fallbackMessageId
}

function parseLastEventSequence(eventId: string) {
  const parsedSequence = Number.parseInt(eventId, 10)
  return Number.isFinite(parsedSequence) ? parsedSequence : null
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
  const skillsFetchingRef = useRef(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [draft, setDraft] = useState('')
  const [preferredToolType, setPreferredToolType] = useState<string | null>(null)
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [requestError, setRequestError] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [agentName, setAgentName] = useState<string | null>(null)
  const [agentWebSearchLocked, setAgentWebSearchLocked] = useState(false)
  
  // 斜杠指令相关状态
  const [slashCommandOpen, setSlashCommandOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)
  const skipSlashSelectRef = useRef(false)
  
  // 上传文件相关状态
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const stickToBottom = useStickToBottom()
  const { containerRef: messagesViewportRef, scrollToBottom } = stickToBottom

  const filteredSkills = useMemo(() => {
    if (!slashQuery) {
      return skills
    }

    const query = slashQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.skillName.toLowerCase().includes(query),
    )
  }, [skills, slashQuery])

  const clearSelectedSkill = () => {
    setPreferredToolType(null)
    setSelectedSkillName('')
  }

  // 处理上传文件
  const handleUploadFile = () => {
    fileInputRef.current?.click()
  }

  // 处理文件选择
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (!isAllowedFileType(file.name)) {
        message.warning(`不支持的文件类型: ${file.name}，仅支持 ${ALLOWED_FILE_EXTENSIONS.join('、')} 格式`)
        continue
      }

      const pendingFile = createPendingUploadedFile(file)
      setUploadedFiles((prev) => [...prev, pendingFile])

      const uploadedFile = await uploadPendingFileToOssWithDocumentParse(pendingFile, file, {
        onProgress: (progress) => {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === pendingFile.id ? { ...f, uploadProgress: progress } : f,
            ),
          )
        },
        onStatusChange: (nextFile) => {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.id === pendingFile.id ? nextFile : f)),
          )
        },
      })

      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === pendingFile.id ? uploadedFile : f)),
      )
    }
    
    event.target.value = ''
  }

  // 删除已添加的文件
  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
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
    const value = location.state as { initialPrompt?: string; toolType?: string | null; uploadedFiles?: UploadedFile[] } | null
    return value?.initialPrompt?.trim() ?? ''
  }, [location.state])

  const initialToolType = useMemo(() => {
    const value = location.state as { initialPrompt?: string; toolType?: string | null; uploadedFiles?: UploadedFile[] } | null
    return value?.toolType ?? null
  }, [location.state])

  const initialUploadedFiles = useMemo(() => {
    const value = location.state as { uploadedFiles?: UploadedFile[] } | null
    return value?.uploadedFiles ?? []
  }, [location.state])

  const initialConversation = useMemo(() => {
    if (!initialPrompt || routeSessionId) {
      return null
    }

    const now = new Date()
    const completedFiles = initialUploadedFiles.filter((f) => f.status === 'completed')
    return {
      userMessage: {
        id: `user-${now.getTime()}`,
        role: 'user' as const,
        content: initialPrompt,
        timestamp: formatTime(now),
        uploadedFiles: completedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          ext: f.ext,
          url: f.url,
        })),
      },
      loadingMessage: {
        id: `assistant-${now.getTime()}`,
        role: 'assistant' as const,
        content: '',
        timestamp: formatTime(now),
        loading: true,
      },
    }
  }, [initialPrompt, initialUploadedFiles, routeSessionId])

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

  const fetchAgentDetail = useCallback(async (agentId: string, signal?: AbortSignal) => {
    try {
      const agentConfig = await loadCustomAgentApiConfig()
      const agent = await viewCustomAgent(agentConfig, agentId, signal)
      
      setAgentName(agent.agent_name)
      setWebSearchEnabled(agent.enable_web_search)
      setAgentWebSearchLocked(!agent.enable_web_search)

      const agentSkills: SkillItem[] = (agent.enabled_skills || []).map((skill: EnabledSkill) => ({
        id: skill.skill_name,
        skillName: skill.skill_name,
        title: skill.chinese_name || skill.skill_name,
        description: skill.description || '',
        template: skill.template || '',
        isSelected: false,
      }))
      setSkills(agentSkills)
    } catch {
      if (!signal?.aborted) {
        setSkills([])
        setAgentWebSearchLocked(false)
      }
    }
  }, [])

  const runAssistantReply = async (
    prompt: string,
    userMessage: ChatMessage,
    loadingMessage: ChatMessage,
    baseMessages: ChatMessage[],
    _toolType: string | null = null,
    uploadedFiles: UploadedFile[] = [],
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

    const completedFiles = uploadedFiles.filter((f) => f.status === 'completed')
    const uploadedFilesPayload = completedFiles.map((f) => ({
      resource_id: f.resourceId ?? f.objectKey,
      file_name: f.name,
      url: f.url,
    }))

    const controller = new AbortController()
    abortControllerRef.current = controller
    let usingSharedBridge = false
    let activeAssistantMessageId = loadingMessage.id
    let sessionId = currentSessionId

    try {
      // 会话一旦创建成功，就必须复用同一个 sessionId，避免刷新或继续追问时被拆成新会话。
      if (!sessionId) {
        const sessionConfig = parseChatSessionConfig(chatConfigText)
        const existingEmptySessionId = await findLatestEmptySession(sessionConfig, controller.signal)
        if (existingEmptySessionId) {
          sessionId = existingEmptySessionId
        } else {
          const createdSession = await createChatSession(chatApiConfig, controller.signal)
          sessionId = createdSession.sessionId
        }
      }

      if (!sessionId) {
        throw new Error('会话创建失败')
      }

      const resolvedSessionId = sessionId
      let lastEventSequence = 0

      const persistDirectStreamSnapshot = (nextMessages: ChatMessage[]) => {
        persistChatStreamSnapshot({
          sessionId: resolvedSessionId,
          messages: nextMessages,
          status: 'streaming',
          activeMessageId: activeAssistantMessageId,
          lastEventSequence,
        })
      }

      const nextMessages = baseMessages.map((item) =>
        item.id === userMessage.id || item.id === loadingMessage.id
          ? {
              ...item,
              sessionId: resolvedSessionId,
            }
          : item,
      )

      messagesRef.current = nextMessages
      setMessages(nextMessages)
      persistDirectStreamSnapshot(nextMessages)
      syncSessionToRoute(resolvedSessionId)

      const streamBridge = streamBridgeRef.current

      if (streamBridge) {
        await streamBridge.startStream({
          sessionId: resolvedSessionId,
          config: chatApiConfig,
          payload: {
            message: prompt,
            enable_web_search: webSearchEnabled,
            include_tool_details: true,
            uploaded_files: uploadedFilesPayload,
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
        resolvedSessionId,
        {
          message: prompt,
          enable_web_search: webSearchEnabled,
          include_tool_details: true,
          uploaded_files: uploadedFilesPayload,
        },
        controller.signal,
      )

      await readSseStream(stream, {
        onEventId(eventId) {
          const nextSequence = parseLastEventSequence(eventId)

          if (nextSequence === null) {
            return
          }

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
          setMessages((prev) =>
            {
              const nextMessages = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
                ...message,
                reasoningContent: `${message.reasoningContent ?? ''}${chunk}`,
              }))
              messagesRef.current = nextMessages
              persistDirectStreamSnapshot(nextMessages)
              return nextMessages
            },
          )
        },
        onToolStart(toolCall) {
          const toolMessageId = activeAssistantMessageId

          setMessages((prev) =>
            {
              const nextMessages = updateAssistantMessageById(
                prev,
                toolMessageId,
                (message) => upsertToolCall(message, toolCall),
              )
              messagesRef.current = nextMessages
              persistDirectStreamSnapshot(nextMessages)
              return nextMessages
            },
          )
        },
        onToolEnd(toolCall) {
          const toolMessageId = activeAssistantMessageId

          void loadCourseTable(chatApiConfig, resolvedSessionId, toolCall, controller.signal)
            .then((courses) => {
              if (!courses.length) {
                return
              }

              setMessages((prev) =>
                {
                  const nextMessages = updateAssistantMessageById(prev, toolMessageId, (message) => ({
                    ...upsertToolCall(message, toolCall),
                    courses,
                  }))
                  messagesRef.current = nextMessages
                  persistDirectStreamSnapshot(nextMessages)
                  return nextMessages
                },
              )
            })
            .catch(() => {
              // 课程文件下载失败时保持普通工具卡展示，不阻断主回答。
            })

          setMessages((prev) =>
            {
              const nextMessages = updateAssistantMessageById(
                prev,
                toolMessageId,
                (message) => upsertToolCall(message, toolCall),
              )
              messagesRef.current = nextMessages
              persistDirectStreamSnapshot(nextMessages)
              return nextMessages
            },
          )
        },
        onReferences(references) {
          setMessages((prev) =>
            {
              const nextMessages = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
                ...message,
                references,
              }))
              messagesRef.current = nextMessages
              persistDirectStreamSnapshot(nextMessages)
              return nextMessages
            },
          )
        },
        onSkillOutput(skillOutput) {
          setMessages((prev) =>
            {
              const nextMessages = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
                ...message,
                skillOutput,
              }))
              messagesRef.current = nextMessages
              persistDirectStreamSnapshot(nextMessages)
              return nextMessages
            },
          )
        },
      })

      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        {
          const nextMessages = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
            ...message,
            timestamp: replyTime,
            loading: false,
          }))
          messagesRef.current = nextMessages
          return nextMessages
        },
      )
      clearChatStreamSnapshot(resolvedSessionId)
      notifyChatSessionHistoryRefresh(resolvedSessionId)
    } catch (error) {
      if (controller.signal.aborted) {
        if (sessionId) {
          clearChatStreamSnapshot(sessionId)
        }
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
      if (sessionId) {
        clearChatStreamSnapshot(sessionId)
      }
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

  const handleStop = useCallback(() => {
    // 优先尝试通过 SharedWorker 中断流式请求
    if (streamBridgeRef.current && currentSessionId) {
      streamBridgeRef.current.stopStream(currentSessionId)
    }
    // 备用：直接 abort（用于非 SharedWorker 路径）
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setMessages((prev) => prev.map((m) =>
      m.loading ? { ...m, loading: false } : m,
    ))
    setIsResponding(false)
  }, [currentSessionId])

  const startAssistantReply = async (prompt: string, toolType: string | null = null, uploadedFiles: UploadedFile[] = []) => {
    const now = new Date()
    const completedFiles = uploadedFiles.filter((f) => f.status === 'completed')
    const userMessage: ChatMessage = {
      id: `user-${now.getTime()}`,
      role: 'user',
      content: prompt,
      timestamp: formatTime(now),
      uploadedFiles: completedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        ext: f.ext,
        url: f.url,
      })),
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

    await runAssistantReply(prompt, userMessage, loadingMessage, nextMessages, toolType, uploadedFiles)
  }

  useEffect(() => {
    if (!initialConversation || routeSessionId) {
      return
    }

    // 首页首轮自动发送放到下一个 tick，再由 cleanup 只取消定时器。
    // 这样 StrictMode 的首轮重挂载只会清掉第一次调度，不会把真正的流式请求 abort 掉。
    const initialPromptTimer = window.setTimeout(() => {
      setRequestError('')
      void runAssistantReply(
        initialPrompt,
        initialConversation.userMessage,
        initialConversation.loadingMessage,
        [initialConversation.userMessage, initialConversation.loadingMessage],
        initialToolType,
        initialUploadedFiles,
      )
    }, 0)

    return () => {
      window.clearTimeout(initialPromptTimer)
    }
  }, [initialConversation, initialPrompt, initialToolType, initialUploadedFiles, routeSessionId])

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
        // 刷新后优先尝试从共享流快照恢复，避免正在返回的 stream 被页面状态重置打断展示。
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

        if (cachedSnapshot?.status === 'streaming' && chatApiConfig) {
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

      if (cachedSnapshot?.status === 'streaming' && chatApiConfig) {
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

              if (nextSequence === null) {
                return
              }

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
                const nextMessages = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
                  ...message,
                  reasoningContent: `${message.reasoningContent ?? ''}${chunk}`,
                }))
                messagesRef.current = nextMessages
                persistDirectStreamSnapshot(nextMessages)
                return nextMessages
              })
            },
            onToolStart(toolCall) {
              const toolMessageId = activeAssistantMessageId

              setMessages((prev) => {
                const nextMessages = updateAssistantMessageById(
                  prev,
                  toolMessageId,
                  (message) => upsertToolCall(message, toolCall),
                )
                messagesRef.current = nextMessages
                persistDirectStreamSnapshot(nextMessages)
                return nextMessages
              })
            },
            onToolEnd(toolCall) {
              const toolMessageId = activeAssistantMessageId

              if (!restoreController) {
                return
              }

              void loadCourseTable(chatApiConfig, routeSessionId, toolCall, restoreController.signal)
                .then((courses) => {
                  if (!courses.length) {
                    return
                  }

                  setMessages((prev) => {
                    const nextMessages = updateAssistantMessageById(prev, toolMessageId, (message) => ({
                      ...upsertToolCall(message, toolCall),
                      courses,
                    }))
                    messagesRef.current = nextMessages
                    persistDirectStreamSnapshot(nextMessages)
                    return nextMessages
                  })
                })
                .catch(() => {
                  // 课程文件下载失败时保持普通工具卡展示，不阻断主回答。
                })

              setMessages((prev) => {
                const nextMessages = updateAssistantMessageById(
                  prev,
                  toolMessageId,
                  (message) => upsertToolCall(message, toolCall),
                )
                messagesRef.current = nextMessages
                persistDirectStreamSnapshot(nextMessages)
                return nextMessages
              })
            },
            onReferences(references) {
              setMessages((prev) => {
                const nextMessages = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
                  ...message,
                  references,
                }))
                messagesRef.current = nextMessages
                persistDirectStreamSnapshot(nextMessages)
                return nextMessages
              })
            },
            onSkillOutput(skillOutput) {
              setMessages((prev) => {
                const nextMessages = updateAssistantMessageById(prev, activeAssistantMessageId, (message) => ({
                  ...message,
                  skillOutput,
                }))
                messagesRef.current = nextMessages
                persistDirectStreamSnapshot(nextMessages)
                return nextMessages
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
          notifyChatSessionHistoryRefresh(routeSessionId)
          setIsResponding(false)
          return
        } catch {
          if (restoreController.signal.aborted || cancelled) {
            return
          }
        }
      }

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
        clearChatStreamSnapshot(routeSessionId)
        setSessionLoading(false)
        
        setAgentWebSearchLocked(false)

        // 如果session有agent_name字段，直接使用
        if (session.agent_name) {
          setAgentName(session.agent_name)
        } else if (session.theme_id) {
          // 主题智能体存在时，把联网锁定状态和技能列表一并同步到输入框。
          await fetchAgentDetail(session.theme_id, controller.signal)
        }
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
  }, [chatApiConfig, fetchAgentDetail, routeSessionId])

  // 当斜杠指令浮层打开时，自动加载技能列表
  useEffect(() => {
    if (slashCommandOpen && skills.length === 0 && !skillsLoading && !skillsFetchingRef.current) {
      skillsFetchingRef.current = true
      void fetchSkills().finally(() => {
        skillsFetchingRef.current = false
      })
    }
  }, [slashCommandOpen, skills.length, skillsLoading, fetchSkills])

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
    if (uploadedFiles.some((f) => f.status === 'uploading' || f.status === 'parsing')) return

    const outgoingPrompt = selectedSkillName
      ? buildSkillInitialPrompt({
          skillName: selectedSkillName,
          template: value,
          title: selectedSkillName,
        })
      : value
    const outgoingToolType = selectedSkillName ? preferredToolType || selectedSkillName : null
    const pendingFiles = [...uploadedFiles]

    setDraft('')
    clearSelectedSkill()
    setUploadedFiles([])
    void startAssistantReply(outgoingPrompt, outgoingToolType, pendingFiles)
  }

  // 跳转到技能管理页面
  const handleManageSkills = () => {
    navigate('/skills', {
      state: {
        mode: 'manage',
      },
    })
  }

  // 选择技能后先进入输入态，和技能管理页”使用”保持一致。
  const handleSelectSkill = (skill: SkillItem) => {
    // 加号选择技能后先进入输入态，用户还能继续补充模板参数，再统一发送。
    setSelectedSkillName(skill.skillName || skill.id)
    setPreferredToolType(skill.skillName || skill.id)
    skipSlashSelectRef.current = true
    setDraft(buildSkillInitialPrompt(skill))
    requestAnimationFrame(() => { skipSlashSelectRef.current = false })
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
            <h1 className={styles.title}>{agentName ?? '问候'}</h1>
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
              <ChatComposer
                variant="agentConversation"
                value={draft}
                onChange={(value) => {
                  setDraft(value)

                  // 检测斜杠指令触发
                  if (skipSlashSelectRef.current) return
                  if (value === '/' && !slashCommandOpen) {
                    setSlashCommandOpen(true)
                    setSlashQuery('')
                    setSelectedSkillIndex(0)
                  } else if (!value.startsWith('/')) {
                    setSlashCommandOpen(false)
                  } else if (value.startsWith('/')) {
                    setSlashQuery(value.slice(1))
                  }
                }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                    return
                  }

                  // 斜杠指令浮层打开时的键盘处理
                  if (slashCommandOpen) {
                    switch (event.key) {
                      case 'ArrowDown':
                        event.preventDefault()
                        setSelectedSkillIndex((prev) =>
                          prev < filteredSkills.length - 1 ? prev + 1 : prev
                        )
                        return
                      case 'ArrowUp':
                        event.preventDefault()
                        setSelectedSkillIndex((prev) => (prev > 0 ? prev - 1 : 0))
                        return
                      case 'Enter':
                        event.preventDefault()
                        event.stopPropagation()
                        if (filteredSkills[selectedSkillIndex]) {
                          handleSelectSkill(filteredSkills[selectedSkillIndex])
                          setSlashCommandOpen(false)
                          setSlashQuery('')
                        }
                        return
                      case 'Escape':
                        event.preventDefault()
                        setSlashCommandOpen(false)
                        return
                    }
                  }

                  if (event.key === 'Backspace' && !draft.trim() && selectedSkillName) {
                    event.preventDefault()
                    clearSelectedSkill()
                    return
                  }

                  // 支持 Enter 发送，Shift+Enter 换行
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSend()
                  }
                }}
                onSend={handleSend}
                placeholder='输入你的想法或输入"/"选择想要使用技能'
                slashCommandOpen={slashCommandOpen}
                slashQuery={slashQuery}
                onSlashQueryChange={setSlashQuery}
                skills={skills}
                filteredSkills={filteredSkills}
                skillsLoading={skillsLoading}
                loadSkills={fetchSkills}
                selectedSkillIndex={selectedSkillIndex}
                onSelectSkill={(skill) => {
                  handleSelectSkill(skill)
                  setSlashCommandOpen(false)
                  setSlashQuery('')
                }}
                onCloseSlashCommand={() => setSlashCommandOpen(false)}
                onManageSkills={handleManageSkills}
                uploadedFiles={uploadedFiles}
                onRemoveFile={handleRemoveFile}
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
                onUploadFile={handleUploadFile}
                webSearchEnabled={webSearchEnabled}
                webSearchLocked={agentWebSearchLocked}
                knowledgeEnabled={false}
                onToggleWebSearch={() => setWebSearchEnabled((value) => !value)}
                onLockedWebSearchClick={() => {
                  void message.info('当前主题智能体未开启联网检索，暂不可配置')
                }}
                onToggleKnowledge={() => {}}
                sendDisabled={!draft.trim() || uploadedFiles.some((f) => f.status === 'uploading' || f.status === 'parsing')}
                isResponding={isResponding}
                onStop={handleStop}
              />
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
