import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  EllipsisOutlined,
  ExportOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import chatConfigText from '../../../config.yaml?raw'
import { useLocation, useNavigate } from 'react-router-dom'
import { AttachmentMenu, type AttachmentSkillItem } from '../../components/common/AttachmentMenu'
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
import styles from './chat.module.less'

type SkillItem = AttachmentSkillItem

type SkillApiResponse = {
  success: boolean
  code: string
  msg: string
  data?: {
    skills?: unknown[]
    total?: number
  }
}

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

export default function ChatPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const abortControllerRef = useRef<AbortController | null>(null)
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false)
  const [draft, setDraft] = useState('')
  const [requestError, setRequestError] = useState('')
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

  // 获取用户技能列表
  const fetchSkills = useCallback(async (signal?: AbortSignal) => {
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
  }, [skillApiConfig])

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

  const handleSend = () => {
    const value = draft.trim()
    if (!value || isResponding) return

    setDraft('')
    void startAssistantReply(value)
  }

  // 跳转到技能管理页面
  const handleManageSkills = () => {
    navigate('/skills')
  }

  // 选择技能后触发对话
  const handleSelectSkill = (skill: SkillItem) => {
    void startAssistantReply(`使用技能：${skill.title}`, skill.skillName || skill.id)
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

  return (
    <main className={styles.page}>
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
            <button type="button" className={styles.headerButton} aria-label="更多">
              <EllipsisOutlined />
            </button>
          </div>
        </header>

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
          </div>
          <div className={styles.footerHint}>{requestError || 'AI 生成内容可能有误，请核实重要信息'}</div>
        </div>
      </section>
    </main>
  )
}
