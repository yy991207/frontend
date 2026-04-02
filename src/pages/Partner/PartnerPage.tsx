import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioOutlined,
  ArrowUpOutlined,
  BarsOutlined,
  CameraFilled,
  CloseOutlined,
  CopyOutlined,
  DownOutlined,
  EditOutlined,
  ExportOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  SmileOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import chatConfigText from '../../../config.yaml?raw'
import { useLocation, useNavigate } from 'react-router-dom'
import homeAvatar from '../../assets/home-avatar.png'
import {
  createChatSession,
  downloadSessionFileContent,
  extractCourseTableFilePath,
  parseChatApiConfig,
  parseCourseTableContent,
  readSseStream,
  streamChatMessage,
  type ChatApiConfig,
  type ChatReference,
  type CourseItem,
  type ToolCall,
} from '../../services/chatService'
import {
  fetchPartnerConfig,
  parsePartnerApiConfig,
  updatePartnerConfig,
  type PartnerApiConfig,
} from '../../services/partnerConfigService'
import styles from './partner.module.less'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  loading?: boolean
  sessionId?: string
  toolCalls?: ToolCall[]
  references?: ChatReference[]
  courses?: CourseItem[]
}

type SettingMenuItem = {
  key: string
  label: string
  icon: React.ReactNode
  children?: SettingMenuItem[]
}

type SkillItem = {
  id: string
  skillName: string
  title: string
  description: string
  isSelected: boolean
}

type SkillApiResponse = {
  success: boolean
  code: string
  msg: string
  data?: {
    skills?: unknown[]
    total?: number
  }
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

function parseSkillApiConfig(rawText: string) {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const managePath = parsedConfig.view_user_skills_path
  const userId = parsedConfig.user_id
  const userIdParam = parsedConfig.skill_user_id_param

  if (!baseUrl || !managePath || !userId || !userIdParam) {
    throw new Error('config.yaml 缺少 url、view_user_skills_path、user_id 或 skill_user_id_param 配置')
  }

  const managePathWithUser = managePath.includes('{user_id}')
    ? managePath.replace('{user_id}', encodeURIComponent(userId))
    : managePath

  return {
    manageEndpoint: buildAbsoluteUrl(baseUrl, managePathWithUser),
    userId,
    userIdParam,
  }
}

function readSkillField(item: Record<string, unknown>, keys: string[]) {
  const value = keys.find((key) => typeof item[key] === 'string' && item[key])
  return value ? String(item[value]).trim() : ''
}

function normalizeSkillItems(items: unknown[]): SkillItem[] {
  return items
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const value = item as Record<string, unknown>
      const title = readSkillField(value, ['chinese_name', 'chinesename', 'chineseName', 'name'])
      const description = readSkillField(value, ['description', 'desc'])
      const skillName = readSkillField(value, ['skill_name', 'skillName', 'name'])

      if (!title) {
        return null
      }

      const id = readSkillField(value, ['id']) || skillName || `${title}-${index}`
      const isSelected = Boolean(value.is_selected ?? value.isSelected)

      return {
        id,
        skillName,
        title,
        description,
        isSelected,
      }
    })
    .filter((item): item is SkillItem => item !== null)
}

function extractSkillItemsFromResponse(data: SkillApiResponse) {
  const payload = data.data as Record<string, unknown> | undefined
  const skills = Array.isArray(payload?.skills)
    ? payload.skills
    : Array.isArray(payload?.items)
      ? payload.items
      : []

  return normalizeSkillItems(skills)
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

const ATTACHMENT_ACTIONS = [
  { key: 'upload', label: '上传文件或图片', icon: <PaperClipOutlined /> },
  { key: 'doc', label: '添加飞书云文档', icon: <FileAddOutlined /> },
  { key: 'skill', label: '技能', icon: <ThunderboltOutlined />, hasArrow: true },
  { key: 'tool', label: '工具', icon: <ToolOutlined />, hasArrow: true },
]

const SETTING_MENU_ITEMS: SettingMenuItem[] = [
  { key: 'personalization', label: '个性化', icon: <SmileOutlined /> },
  { key: 'skill-management', label: '技能管理', icon: <ThunderboltOutlined /> },
  { key: 'conversation-management', label: '会话管理', icon: <BarsOutlined /> },
  {
    key: 'tasks',
    label: '任务',
    icon: <BarsOutlined />,
    children: [
      { key: 'scheduled-tasks', label: '定时触发任务', icon: <BarsOutlined /> },
      { key: 'event-tasks', label: '事件触发任务', icon: <BarsOutlined /> },
      { key: 'conversation-tasks', label: '会话任务', icon: <BarsOutlined /> },
    ],
  },
  { key: 'workspace', label: '工作空间', icon: <BarsOutlined /> },
  { key: 'model-management', label: '模型管理', icon: <BarsOutlined /> },
  {
    key: 'security',
    label: '安全',
    icon: <BarsOutlined />,
    children: [
      { key: 'permission-management', label: '权限管理', icon: <BarsOutlined /> },
    ],
  },
]

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function renderMarkdownContent(content: string) {
  return content.split('\n').map((line, index) => {
    if (line.startsWith('## ')) {
      return <h3 key={index}>{line.replace('## ', '')}</h3>
    }

    if (line.startsWith('**') && line.includes('**')) {
      return (
        <p key={index}>
          <strong>{line.match(/\*\*(.*?)\*\*/)?.[1]}</strong>
          {line.replace(/\*\*.*?\*\*/, '')}
        </p>
      )
    }

    if (line.startsWith('- ')) {
      return (
        <ul key={index}>
          <li>{line.replace('- ', '')}</li>
        </ul>
      )
    }

    if (line.trim() === '') {
      return null
    }

    return <p key={index}>{line}</p>
  })
}

export default function PartnerPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const abortControllerRef = useRef<AbortController | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const [toolInfoOpen, setToolInfoOpen] = useState(false)
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const [skillSearchQuery, setSkillSearchQuery] = useState('')
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false)
  const [draft, setDraft] = useState('')
  const [requestError, setRequestError] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeSettingKey, setActiveSettingKey] = useState('personalization')
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['tasks', 'security'])
  const [configTab, setConfigTab] = useState<'soul' | 'user' | 'identity'>('soul')
  // 单独维护助手名称编辑态，避免影响其他设置区域的展示逻辑。
  const [agentName, setAgentName] = useState('Lily')
  const [isNameModalOpen, setIsNameModalOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('Lily')

  // 行为准则编辑状态
  const [isEditingSoul, setIsEditingSoul] = useState(false)
  const [soulContent, setSoulContent] = useState('')
  const [soulContentDraft, setSoulContentDraft] = useState('')
  const [isEditingUser, setIsEditingUser] = useState(false)
  const [userContent, setUserContent] = useState('')
  const [userContentDraft, setUserContentDraft] = useState('')
  const [isEditingIdentity, setIsEditingIdentity] = useState(false)
  const [identityContent, setIdentityContent] = useState('')
  const [identityContentDraft, setIdentityContentDraft] = useState('')
  const [partnerConfigLoading, setPartnerConfigLoading] = useState(false)
  const [partnerConfigError, setPartnerConfigError] = useState('')
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

  const partnerApiConfig = useMemo<PartnerApiConfig | null>(() => {
    try {
      return parsePartnerApiConfig(chatConfigText)
    } catch {
      return null
    }
  }, [])

  // 根据搜索关键词过滤技能列表
  const filteredSkills = useMemo(() => {
    if (!skillSearchQuery.trim()) {
      return skills
    }
    const query = skillSearchQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.skillName.toLowerCase().includes(query),
    )
  }, [skills, skillSearchQuery])

  // 获取用户技能列表
  const fetchSkills = async (signal?: AbortSignal) => {
    if (!skillApiConfig) {
      setSkills([])
      return
    }

    setSkillsLoading(true)

    try {
      const requestUrl = new URL(skillApiConfig.manageEndpoint)
      requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)

      const response = await fetch(requestUrl.toString(), { signal })

      if (!response.ok) {
        throw new Error('技能接口请求失败')
      }

      const data = (await response.json()) as SkillApiResponse

      if (!data.success) {
        throw new Error(data.msg || '技能接口返回失败')
      }

      const nextSkills = extractSkillItemsFromResponse(data)
      setSkills(nextSkills)
    } catch {
      if (!signal?.aborted) {
        setSkills([])
      }
    } finally {
      if (!signal?.aborted) {
        setSkillsLoading(false)
      }
    }
  }

  // 打开技能菜单时加载技能列表
  useEffect(() => {
    if (!skillMenuOpen) {
      return
    }

    const controller = new AbortController()
    void fetchSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [skillMenuOpen])

  useEffect(() => {
    if (!isSettingsOpen || !partnerApiConfig) {
      return
    }

    const controller = new AbortController()

    const loadPartnerConfig = async () => {
      setPartnerConfigLoading(true)
      setPartnerConfigError('')

      try {
        const config = await fetchPartnerConfig(partnerApiConfig, controller.signal)

        setAgentName(config.agentName || '智能伙伴')
        setNameDraft(config.agentName || '智能伙伴')
        setSoulContent(config.soulContent)
        setSoulContentDraft(config.soulContent)
        setUserContent(config.userContent)
        setUserContentDraft(config.userContent)
        setIdentityContent(config.identityContent)
        setIdentityContentDraft(config.identityContent)
      } catch (error) {
        if (!controller.signal.aborted) {
          setPartnerConfigError(error instanceof Error ? error.message : '智能伙伴配置加载失败')
        }
      } finally {
        if (!controller.signal.aborted) {
          setPartnerConfigLoading(false)
        }
      }
    }

    void loadPartnerConfig()

    return () => {
      controller.abort()
    }
  }, [isSettingsOpen, partnerApiConfig])

  // 跳转到技能管理页面
  const handleManageSkills = () => {
    navigate('/skills', {
      state: {
        mode: 'manage',
      },
    })
  }

  // 选择技能后触发对话
  const handleSelectSkill = (skill: SkillItem) => {
    setSkillMenuOpen(false)
    setAttachMenuOpen(false)
    setSkillSearchQuery('')
    void startAssistantReply(`使用技能：${skill.title}`, skill.skillName || skill.id)
  }


  const initialPrompt = useMemo(() => {
    const value = location.state as { initialPrompt?: string; toolType?: string | null } | null
    return value?.initialPrompt?.trim() ?? ''
  }, [location.state])

  const initialToolType = useMemo(() => {
    const value = location.state as { initialPrompt?: string; toolType?: string | null } | null
    return value?.toolType ?? null
  }, [location.state])

  const initialConversation = useMemo(() => {
    if (!initialPrompt) {
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
  }, [initialPrompt])

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialConversation ? [initialConversation.userMessage, initialConversation.loadingMessage] : [],
  )
  const [isResponding, setIsResponding] = useState(() => Boolean(initialConversation))

  const runAssistantReply = async (prompt: string, loadingMessageId: string, toolType: string | null = null) => {
    if (!chatApiConfig) {
      setRequestError('聊天配置读取失败，请检查 config.yaml')
      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        prev.map((item) =>
          item.id === loadingMessageId
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

    try {
      const { sessionId } = await createChatSession(chatApiConfig, controller.signal)
      setMessages((prev) =>
        prev.map((item) =>
          item.id === loadingMessageId
            ? {
                ...item,
                sessionId,
              }
            : item,
        ),
      )

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
        onTextDelta(chunk) {
          const replyTime = formatTime(new Date())
          setMessages((prev) =>
            prev.map((item) =>
              item.id === loadingMessageId
                ? {
                    ...item,
                    content: `${item.content}${chunk}`,
                    timestamp: replyTime,
                    loading: false,
                  }
                : item,
            ),
          )
        },
        onToolStart(toolCall) {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === loadingMessageId
                ? upsertToolCall(item, toolCall)
                : item,
            ),
          )
        },
        onToolEnd(toolCall) {
          void loadCourseTable(chatApiConfig, sessionId, toolCall, controller.signal)
            .then((courses) => {
              if (!courses.length) {
                return
              }

              setMessages((prev) =>
                prev.map((item) =>
                  item.id === loadingMessageId
                    ? {
                        ...upsertToolCall(item, toolCall),
                        courses,
                      }
                    : item,
                ),
              )
            })
            .catch(() => {
              // 课程文件下载失败时保持普通工具卡展示，不阻断主回答。
            })

          setMessages((prev) =>
            prev.map((item) =>
              item.id === loadingMessageId
                ? upsertToolCall(item, toolCall)
                : item,
            ),
          )
        },
        onReferences(references) {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === loadingMessageId
                ? {
                    ...item,
                    references,
                  }
                : item,
            ),
          )
        },
      })

      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        prev.map((item) =>
          item.id === loadingMessageId
            ? {
                ...item,
                timestamp: replyTime,
                loading: false,
              }
            : item,
        ),
      )
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        prev.map((item) =>
          item.id === loadingMessageId
            ? {
                ...item,
                content: '请求失败，请稍后重试。',
                timestamp: replyTime,
                loading: false,
              }
            : item,
        ),
      )
      setRequestError(error instanceof Error ? error.message : '请求失败，请稍后重试。')
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }

      setIsResponding(false)
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

    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setIsResponding(true)

    await runAssistantReply(prompt, loadingMessage.id, toolType)
  }

  useEffect(() => {
    if (!initialConversation) {
      return
    }

    setRequestError('')
    void runAssistantReply(initialPrompt, initialConversation.loadingMessage.id, initialToolType)

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [initialConversation, initialPrompt, initialToolType])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setAttachMenuOpen(false)
        setToolMenuOpen(false)
        setToolInfoOpen(false)
        setSkillMenuOpen(false)
        setSkillSearchQuery('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (!isNameModalOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseNameModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isNameModalOpen, agentName])

  const handleSend = () => {
    const value = draft.trim()
    if (!value || isResponding) return

    setDraft('')
    setAttachMenuOpen(false)
    setToolMenuOpen(false)
    setToolInfoOpen(false)
    setSkillMenuOpen(false)
    setSkillSearchQuery('')
    void startAssistantReply(value)
  }

  const handleStop = () => {
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

  const handleCopy = async (content: string) => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      // 复制失败时不额外打断页面交互。
    }
  }

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const handleSettingClick = (key: string) => {
    setActiveSettingKey(key)
  }

  const handleOpenNameModal = () => {
    setNameDraft(agentName)
    setIsNameModalOpen(true)
  }

  const handleCloseNameModal = () => {
    setNameDraft(agentName)
    setIsNameModalOpen(false)
  }

  const handleConfirmName = () => {
    const nextName = nameDraft.trim()
    if (!nextName || !partnerApiConfig) {
      return
    }

    void updatePartnerConfig(partnerApiConfig, 'agent_name', nextName)
      .then(() => {
        setAgentName(nextName)
        setIsNameModalOpen(false)
        setPartnerConfigError('')
      })
      .catch((error) => {
        setPartnerConfigError(error instanceof Error ? error.message : '智能伙伴配置更新失败')
      })
  }

  const handleEditSoul = () => {
    setIsEditingSoul(true)
    setSoulContentDraft(soulContent)
  }

  const handleCancelEditSoul = () => {
    setIsEditingSoul(false)
    setSoulContentDraft(soulContent)
  }

  const handleSaveSoul = () => {
    if (!partnerApiConfig) {
      return
    }

    void updatePartnerConfig(partnerApiConfig, 'SOUL.md', soulContentDraft)
      .then(() => {
        setSoulContent(soulContentDraft)
        setIsEditingSoul(false)
        setPartnerConfigError('')
      })
      .catch((error) => {
        setPartnerConfigError(error instanceof Error ? error.message : '智能伙伴配置更新失败')
      })
  }

  const handleEditUser = () => {
    setIsEditingUser(true)
    setUserContentDraft(userContent)
  }

  const handleCancelEditUser = () => {
    setIsEditingUser(false)
    setUserContentDraft(userContent)
  }

  const handleSaveUser = () => {
    if (!partnerApiConfig) {
      return
    }

    void updatePartnerConfig(partnerApiConfig, 'USER.md', userContentDraft)
      .then(() => {
        setUserContent(userContentDraft)
        setIsEditingUser(false)
        setPartnerConfigError('')
      })
      .catch((error) => {
        setPartnerConfigError(error instanceof Error ? error.message : '智能伙伴配置更新失败')
      })
  }

  const handleEditIdentity = () => {
    setIsEditingIdentity(true)
    setIdentityContentDraft(identityContent)
  }

  const handleCancelEditIdentity = () => {
    setIsEditingIdentity(false)
    setIdentityContentDraft(identityContent)
  }

  const handleSaveIdentity = () => {
    if (!partnerApiConfig) {
      return
    }

    void updatePartnerConfig(partnerApiConfig, 'IDENTITY.md', identityContentDraft)
      .then(() => {
        setIdentityContent(identityContentDraft)
        setIsEditingIdentity(false)
        setPartnerConfigError('')
      })
      .catch((error) => {
        setPartnerConfigError(error instanceof Error ? error.message : '智能伙伴配置更新失败')
      })
  }

  const renderSettingContent = () => {
    switch (activeSettingKey) {
      case 'personalization':
        const currentContent = configTab === 'soul' ? soulContent : configTab === 'user' ? userContent : identityContent
        const currentDraft = configTab === 'soul' ? soulContentDraft : configTab === 'user' ? userContentDraft : identityContentDraft
        const isEditingCurrent = configTab === 'soul' ? isEditingSoul : configTab === 'user' ? isEditingUser : isEditingIdentity
        const currentLabel = configTab === 'soul' ? 'SOUL.md' : configTab === 'user' ? 'USER.md' : 'IDENTITY.md'
        const currentDescription =
          configTab === 'soul'
            ? '智能伙伴必须遵守的底线规则、安全框架和核心价值观'
            : configTab === 'user'
              ? '关于当前用户的画像、协作习惯和偏好记录'
              : '智能伙伴的身份、风格、签名与角色设定'
        const handleEditCurrent = configTab === 'soul' ? handleEditSoul : configTab === 'user' ? handleEditUser : handleEditIdentity
        const handleCancelCurrent = configTab === 'soul' ? handleCancelEditSoul : configTab === 'user' ? handleCancelEditUser : handleCancelEditIdentity
        const handleSaveCurrent = configTab === 'soul' ? handleSaveSoul : configTab === 'user' ? handleSaveUser : handleSaveIdentity
        const handleDraftChange =
          configTab === 'soul'
            ? setSoulContentDraft
            : configTab === 'user'
              ? setUserContentDraft
              : setIdentityContentDraft

        return (
          <div className={styles.settingContent}>
            <h2 className={styles.settingTitle}>个性化</h2>
            <p className={styles.settingDesc}>智能伙伴的个性化配置，会根据对话自动更新，也支持直接编辑</p>
            {partnerConfigLoading ? <div className={styles.settingStatus}>配置加载中...</div> : null}
            {partnerConfigError ? <div className={styles.settingStatus}>{partnerConfigError}</div> : null}
            <div className={`${styles.settingCard} ${styles.profileCard}`}>
              <div className={styles.avatarRow}>
                <div className={styles.avatarWrap}>
                  <img src={homeAvatar} alt={agentName} className={styles.avatar} />
                  <button type="button" className={styles.cameraBtn} aria-label="修改头像">
                    <CameraFilled />
                  </button>
                </div>
                <div className={styles.profileMeta}>
                  <button
                    type="button"
                    className={styles.nameEditTrigger}
                    onClick={handleOpenNameModal}
                    aria-label="编辑助手名称"
                  >
                    <span className={styles.avatarName}>{agentName}</span>
                    <EditOutlined className={styles.nameEditIcon} />
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.settingTabs}>
              <button
                type="button"
                className={`${styles.settingTab} ${configTab === 'soul' ? styles.settingTabActive : ''}`}
                onClick={() => setConfigTab('soul')}
              >
                行为准则
              </button>
              <button
                type="button"
                className={`${styles.settingTab} ${configTab === 'user' ? styles.settingTabActive : ''}`}
                onClick={() => setConfigTab('user')}
              >
                用户档案
              </button>
              <button
                type="button"
                className={`${styles.settingTab} ${configTab === 'identity' ? styles.settingTabActive : ''}`}
                onClick={() => setConfigTab('identity')}
              >
                智能伙伴档案
              </button>
            </div>
            <div className={styles.settingCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTag}>{currentLabel}</span>
                <span className={styles.cardDesc}>{currentDescription}</span>
                {isEditingCurrent ? (
                  <div className={styles.editActions}>
                    <button type="button" className={styles.cancelBtn} onClick={handleCancelCurrent}>取消</button>
                    <button type="button" className={styles.saveBtn} onClick={handleSaveCurrent}>保存</button>
                  </div>
                ) : (
                  <button type="button" className={styles.editBtn} onClick={handleEditCurrent}>编辑</button>
                )}
              </div>
              {isEditingCurrent ? (
                <textarea
                  className={styles.markdownEditor}
                  value={currentDraft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  placeholder="请输入行为准则内容..."
                />
              ) : (
                <div className={styles.markdownContent}>{renderMarkdownContent(currentContent)}</div>
              )}
            </div>
          </div>
        )
      default:
        return (
          <div className={styles.settingContent}>
            <h2 className={styles.settingTitle}>
              {SETTING_MENU_ITEMS.find((item) => item.key === activeSettingKey)?.label ||
                SETTING_MENU_ITEMS.flatMap((item) => item.children || []).find((child) => child.key === activeSettingKey)?.label}
            </h2>
            <p className={styles.settingDesc}>该功能模块正在开发中...</p>
          </div>
        )
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        {isSettingsOpen ? (
          <>
            <div className={styles.settingsTopBar}>
              <h2 className={styles.settingsTopTitle}>智能伙伴设置</h2>
              <button
                type="button"
                className={styles.closeSettingsBtn}
                onClick={() => setIsSettingsOpen(false)}
                aria-label="关闭设置"
              >
                <CloseOutlined />
              </button>
            </div>

            <div className={styles.settingsSplitPanel}>
              <div className={styles.settingsSidebar}>
                <div className={styles.settingsMenu}>
                  {SETTING_MENU_ITEMS.map((item) => (
                    <div key={item.key}>
                      <button
                        type="button"
                        className={`${styles.settingsMenuItem} ${activeSettingKey === item.key ? styles.settingsMenuItemActive : ''}`}
                        onClick={() => {
                          if (item.children) {
                            toggleExpanded(item.key)
                          } else {
                            handleSettingClick(item.key)
                          }
                        }}
                      >
                        <span className={styles.settingsMenuIcon}>{item.icon}</span>
                        <span className={styles.settingsMenuLabel}>{item.label}</span>
                        {item.children ? (
                          <DownOutlined
                            className={`${styles.settingsMenuArrow} ${expandedKeys.includes(item.key) ? styles.settingsMenuArrowOpen : ''}`}
                          />
                        ) : null}
                      </button>
                      {item.children && expandedKeys.includes(item.key) ? (
                        <div className={styles.settingsSubMenu}>
                          {item.children.map((child) => (
                            <button
                              key={child.key}
                              type="button"
                              className={`${styles.settingsSubMenuItem} ${activeSettingKey === child.key ? styles.settingsSubMenuItemActive : ''}`}
                              onClick={() => handleSettingClick(child.key)}
                            >
                              {child.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.settingsContent}>
                <div className={styles.settingsContentBody}>{renderSettingContent()}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className={styles.chatTopBar}>
              <h1 className={styles.title}>{agentName}</h1>
              <div className={styles.headerActions}>
                <button type="button" className={styles.headerButton} aria-label="分享">
                  <ExportOutlined />
                </button>
                <button type="button" className={styles.headerButton} aria-label="文件夹">
                  <FolderOpenOutlined />
                </button>
                <button
                  type="button"
                  className={styles.headerButton}
                  aria-label="设置"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <BarsOutlined />
                </button>
              </div>
            </header>

            <div className={styles.chatMainPanel}>
              <div className={styles.messages}>
                <div className={styles.messageColumn}>
                  {messages.map((message) =>
                    message.role === 'user' ? (
                      <div key={message.id} className={styles.userRow}>
                        <div className={styles.userMessageWrap}>
                          <div className={styles.userBubble}>{message.content}</div>
                          <div className={styles.userActions}>
                            <span>{message.timestamp}</span>
                            <button type="button" className={styles.inlineAction} onClick={() => handleCopy(message.content)}>
                              <CopyOutlined />
                              <span>复制</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={message.id} className={styles.assistantRow}>
                        {message.loading ? (
                          <div className={styles.loadingDots}>
                            <span className={styles.dot} />
                            <span className={styles.dot} />
                            <span className={styles.dot} />
                          </div>
                        ) : (
                          <div className={styles.assistantMessageWrap}>
                            {message.toolCalls?.length ? (
                              <div className={styles.toolCallList}>
                                {message.toolCalls.map((toolCall) => (
                                  <div key={toolCall.runId} className={styles.toolCard}>
                                    <div className={styles.toolCardHeader}>
                                      <span className={styles.toolCardTitle}>{getToolDisplayTitle(toolCall)}</span>
                                      <span className={styles.toolCardStatus}>{toolCall.status === 'running' ? '执行中' : '已完成'}</span>
                                    </div>
                                    <div className={styles.toolCardSummary}>{getToolDisplaySummary(toolCall)}</div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {message.courses?.length ? (
                              <div className={styles.courseCard}>
                                <div className={styles.courseCardHeader}>
                                  <span className={styles.courseCardTitle}>课程推荐</span>
                                  <span className={styles.courseCardMeta}>{message.courses.length} 门课程</span>
                                </div>
                                <div className={styles.courseList}>
                                  {message.courses.map((course) => (
                                    <div key={`${course.resourceId || course.title}-${course.duration || ''}`} className={styles.courseItem}>
                                      <div className={styles.courseItemTitleRow}>
                                        <span className={styles.courseItemTitle}>{course.title}</span>
                                        {course.duration ? <span className={styles.courseItemDuration}>{course.duration}</span> : null}
                                      </div>
                                      {course.description ? <div className={styles.courseItemDesc}>{course.description}</div> : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            <div className={styles.assistantText}>{message.content}</div>
                            {message.references?.length ? (
                              <div className={styles.referenceList}>
                                {message.references.map((reference, index) => (
                                  <a
                                    key={`${reference.title || 'ref'}-${index}`}
                                    className={styles.referenceItem}
                                    href={reference.url || '#'}
                                    target={reference.url ? '_blank' : undefined}
                                    rel={reference.url ? 'noreferrer' : undefined}
                                  >
                                    {reference.title || reference.url || `参考资料 ${index + 1}`}
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            <div className={styles.assistantFooter}>
                              <button type="button" className={styles.inlineAction} onClick={() => handleCopy(message.content)}>
                                <CopyOutlined />
                                <span>复制</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className={styles.composerArea}>
                <div ref={composerRef} className={styles.composerWrap}>
                  <div className={styles.composer}>
                    <div className={styles.attachTriggerWrap}>
                      <button
                        type="button"
                        className={`${styles.circleButton} ${styles.attachButton} ${attachMenuOpen ? styles.attachButtonActive : ''}`}
                        aria-label={attachMenuOpen ? '关闭上传菜单' : '打开上传菜单'}
                        aria-expanded={attachMenuOpen}
                        onClick={() => setAttachMenuOpen((value) => !value)}
                      >
                        {attachMenuOpen ? <CloseOutlined /> : <PlusOutlined />}
                      </button>
                      {!attachMenuOpen ? <div className={styles.attachTooltip}>上传附件/技能等</div> : null}
                    </div>
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
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
                  <div
                    className={`${styles.attachMenuLayer} ${attachMenuOpen ? styles.attachMenuLayerOpen : ''}`}
                    onMouseLeave={() => {
                      setToolMenuOpen(false)
                      setToolInfoOpen(false)
                    }}
                  >
                    <div className={styles.attachMenu} role="menu">
                      {ATTACHMENT_ACTIONS.map((action) =>
                        action.key === 'tool' ? (
                          <button
                            key={action.key}
                            type="button"
                            className={`${styles.attachMenuItem} ${toolMenuOpen ? styles.attachMenuItemActive : ''}`}
                            onMouseEnter={() => {
                              setToolMenuOpen(true)
                              setSkillMenuOpen(false)
                            }}
                          >
                            <span className={styles.attachMenuMain}>
                              <span className={styles.attachMenuIcon}>{action.icon}</span>
                              <span>{action.label}</span>
                            </span>
                            <RightOutlined className={styles.attachMenuArrow} />
                          </button>
                        ) : action.key === 'skill' ? (
                          <button
                            key={action.key}
                            type="button"
                            className={`${styles.attachMenuItem} ${skillMenuOpen ? styles.attachMenuItemActive : ''}`}
                            onMouseEnter={() => {
                              setSkillMenuOpen(true)
                              setToolMenuOpen(false)
                            }}
                          >
                            <span className={styles.attachMenuMain}>
                              <span className={styles.attachMenuIcon}>{action.icon}</span>
                              <span>{action.label}</span>
                            </span>
                            <RightOutlined className={styles.attachMenuArrow} />
                          </button>
                        ) : (
                          <button
                            key={action.key}
                            type="button"
                            className={styles.attachMenuItem}
                            onMouseEnter={() => {
                              setToolMenuOpen(false)
                              setSkillMenuOpen(false)
                            }}
                          >
                            <span className={styles.attachMenuMain}>
                              <span className={styles.attachMenuIcon}>{action.icon}</span>
                              <span>{action.label}</span>
                            </span>
                            {action.hasArrow ? <RightOutlined className={styles.attachMenuArrow} /> : null}
                          </button>
                        ),
                      )}
                    </div>

                    <div className={`${styles.skillSubmenu} ${skillMenuOpen ? styles.skillSubmenuOpen : ''}`}>
                      <div className={styles.skillSubmenuHeader}>
                        <span>技能</span>
                      </div>
                      <div className={styles.skillSearchBox}>
                        <SearchOutlined className={styles.skillSearchIcon} />
                        <input
                          type="text"
                          className={styles.skillSearchInput}
                          placeholder="搜索技能"
                          value={skillSearchQuery}
                          onChange={(e) => setSkillSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className={styles.skillList}>
                        {skillsLoading ? (
                          <div className={styles.skillLoading}>加载中...</div>
                        ) : filteredSkills.length === 0 ? (
                          <div className={styles.skillEmpty}>
                            {skillSearchQuery ? '未找到匹配的技能' : '暂无技能'}
                          </div>
                        ) : (
                          filteredSkills.map((skill) => (
                            <button
                              key={skill.id}
                              type="button"
                              className={styles.skillItem}
                              onClick={() => handleSelectSkill(skill)}
                            >
                              <div className={styles.skillItemIcon}>
                                <ThunderboltOutlined />
                              </div>
                              <div className={styles.skillItemInfo}>
                                <div className={styles.skillItemTitle}>{skill.title}</div>
                                <div className={styles.skillItemDesc}>{skill.description}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      <button type="button" className={styles.skillManageButton} onClick={handleManageSkills}>
                        <span className={styles.attachMenuMain}>
                          <span className={styles.toolItemMain}>
                            <SettingOutlined />
                            <span>管理技能</span>
                          </span>
                        </span>
                      </button>
                    </div>

                    <div className={`${styles.toolSubmenu} ${toolMenuOpen ? styles.toolSubmenuOpen : ''}`}>
                      <div className={styles.toolSubmenuHeader}>
                        <span>工具</span>
                        <button
                          type="button"
                          className={styles.toolInfoButton}
                          aria-label="工具说明"
                          onClick={() => setToolInfoOpen((value) => !value)}
                        >
                          <InfoCircleOutlined />
                        </button>
                        {toolInfoOpen ? (
                          <div className={styles.toolInfoPopover}>
                            默认内置飞书相关工具：知识问答、消息、妙记、云文档、多维表格、日程、任务
                          </div>
                        ) : null}
                      </div>

                      <div className={styles.toolItem}>
                        <span className={styles.toolItemMain}>
                          <GlobalOutlined />
                          <span>互联网检索</span>
                        </span>
                        <button
                          type="button"
                          className={`${styles.switchButton} ${webSearchEnabled ? styles.switchButtonOn : ''}`}
                          onClick={() => setWebSearchEnabled((value) => !value)}
                        >
                          <span className={styles.switchThumb} />
                        </button>
                      </div>

                      <div className={styles.toolItem}>
                        <span className={styles.toolItemMain}>
                          <LinkOutlined />
                          <span>自定义知识</span>
                        </span>
                        <button
                          type="button"
                          className={`${styles.switchButton} ${knowledgeEnabled ? styles.switchButtonOn : ''}`}
                          onClick={() => setKnowledgeEnabled((value) => !value)}
                        >
                          <span className={styles.switchThumb} />
                        </button>
                      </div>

                      <button type="button" className={`${styles.toolItem} ${styles.toolManageButton}`}>
                        <span className={styles.attachMenuMain}>
                          <span className={styles.toolItemMain}>
                            <SettingOutlined />
                            <span>工具管理</span>
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className={styles.footerHint}>{requestError || 'AI 生成内容可能有误，请核实重要信息'}</div>
              </div>
            </div>
          </>
        )}
      </section>
      {isNameModalOpen ? (
        <div className={styles.nameModalMask} onClick={handleCloseNameModal}>
          <div
            className={styles.nameModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-name-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.nameModalHeader}>
              <h3 id="partner-name-modal-title" className={styles.nameModalTitle}>编辑名称</h3>
              <button
                type="button"
                className={styles.nameModalClose}
                onClick={handleCloseNameModal}
                aria-label="关闭编辑名称弹窗"
              >
                <CloseOutlined />
              </button>
            </div>
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              className={styles.nameModalInput}
              placeholder="请输入助手名称"
              autoFocus
            />
            <div className={styles.nameModalActions}>
              <button type="button" className={styles.nameModalSecondaryBtn} onClick={handleCloseNameModal}>取消</button>
              <button
                type="button"
                className={styles.nameModalPrimaryBtn}
                onClick={handleConfirmName}
                disabled={!nameDraft.trim()}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
