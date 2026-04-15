import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowUpOutlined,
  CameraOutlined,
  EditOutlined,
  GlobalOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { message, Tooltip } from 'antd'
import EditAgentModal from '../../components/common/EditAgentModal'
import SkillConfigModal from '../../components/common/SkillConfigModal'
import KnowledgeSpaceModal from '../../components/common/KnowledgeSpaceModal'
import SkillDetailPanel from '../../components/common/SkillDetailPanel'
import { MessageList } from '../../components/chat/message-list'
import { FileAttachmentPreview } from '../../components/common/FileAttachmentPreview'
import { ChatComposer } from '../../components/common/ChatComposer'
import SkillTemplateInput from '../../components/common/SkillTemplateInput'
import { ArtifactsProvider, useArtifacts } from '../../components/chat/artifacts-context'
import { ArtifactFileDetail } from '../../components/chat/artifact-file-detail'
import {
  createPendingUploadedFile,
  type UploadedFile,
  isAllowedFileType,
  ALLOWED_FILE_EXTENSIONS,
} from '../../services/ossUploadService'
import { uploadPendingFileToOssWithDocumentParse } from '../../services/agentFileUploadService'
import {
  loadCustomAgentApiConfig,
  createCustomAgent,
  chatCustomAgentStream,
  type EnabledSkill,
  type PresetQuestion,
  type CustomAgentApiConfig,
  type RecommendedSkill,
} from '../../services/customAgentService'
import type { ToolCall, ChatReference, SkillOutputItem } from '../../core/messages/types'
import {
  adaptChatMessages,
} from '../../core/messages/adapters'
import { groupMessages, resolveAssistantCopyTargets } from '../../core/messages/utils'
import type { LegacyChatMessage as ChatMessage } from '../../core/messages/types'
import chatStyles from '../../pages/Chat/chat.module.less'
import styles from '../AgentDetail/agentDetail.module.less'

type GeneratedTemplateState = {
  generatedTemplate?: {
    agentName: string
    description: string
    agentPrompt: string
    presetQuestions: PresetQuestion[]
    recommendedSkills?: RecommendedSkill[]
  }
}

function ConfigCard({
  icon,
  title,
  children,
  extra,
  defaultExpanded = true,
}: {
  icon?: React.ReactNode
  title: string
  children: React.ReactNode
  extra?: React.ReactNode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section className={styles.configCard}>
      <div
        className={styles.configCardHeader}
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.configCardTitleWrap}>
          <span className={`${styles.configCardArrow} ${expanded ? styles.configCardArrowExpanded : ''}`}>›</span>
          {icon ? <span className={styles.configCardIcon}>{icon}</span> : null}
          <h4 className={styles.configCardTitle}>{title}</h4>
        </div>
        {extra ? (
          <div
            className={styles.configCardExtra}
            onClick={(e) => e.stopPropagation()}
          >
            {extra}
          </div>
        ) : null}
      </div>
      {expanded && <div className={styles.configCardBody}>{children}</div>}
    </section>
  )
}

export default function AgentCreatePage() {
  return (
    <ArtifactsProvider>
      <AgentCreatePageContent />
    </ArtifactsProvider>
  )
}

function AgentCreatePageContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as GeneratedTemplateState | null
  const [agentName, setAgentName] = useState('未命名智能体')
  const [agentSubtitle, setAgentSubtitle] = useState('')
  const [agentInstruction, setAgentInstruction] = useState('')
  const [agentSkills, setAgentSkills] = useState<EnabledSkill[]>([])
  const [hoveredSkillName, setHoveredSkillName] = useState<string | null>(null)
  const [agentQuestions, setAgentQuestions] = useState<PresetQuestion[]>([])
  const [expandedQuestionIndex, setExpandedQuestionIndex] = useState<number | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [resourceIds, setResourceIds] = useState<string[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [skillModalVisible, setSkillModalVisible] = useState(false)
  const [knowledgeModalVisible, setKnowledgeModalVisible] = useState(false)
  const [expandedSkillName, setExpandedSkillName] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [knowledgeSpaceEnabled, setKnowledgeSpaceEnabled] = useState(false)
  const messageShownRef = useRef(false)

  const [agentConfig, setAgentConfig] = useState<CustomAgentApiConfig | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesRef = useRef<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [recommendedSkills, setRecommendedSkills] = useState<RecommendedSkill[]>([])
  const { addFile, selectFile, open: artifactOpen, selectedFile } = useArtifacts()
  const sessionBaseUrl = useMemo(() => {
    if (!agentConfig) return null
    try {
      const url = new URL(agentConfig.chatAgentEndpoint)
      return `${url.protocol}//${url.host}`
    } catch {
      return null
    }
  }, [agentConfig])

  const handleOpenFile = useCallback((filepath: string, originalUrl?: string) => {
    if (!sessionBaseUrl) return
    const artifactFile = { filepath, sessionId: 'create-preview', baseUrl: sessionBaseUrl, originalUrl }
    addFile(artifactFile)
    selectFile(artifactFile)
  }, [sessionBaseUrl, addFile, selectFile])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const adaptedMessages = useMemo(() => adaptChatMessages(messages), [messages])
  const groupedMessages = useMemo(() => groupMessages(adaptedMessages), [adaptedMessages])
  const assistantCopyTargets = useMemo(
    () => resolveAssistantCopyTargets(adaptedMessages, { excludeLastTurn: isResponding }),
    [adaptedMessages, isResponding],
  )

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopiedMessageId(messageId)
    window.setTimeout(() => setCopiedMessageId((current) => (current === messageId ? null : current)), 1200)
  }, [])

  function getToolDisplayTitle(toolCall: ToolCall) {
    const label = typeof toolCall.toolDisplay?.tool_label === 'string' ? toolCall.toolDisplay.tool_label : ''
    return label || toolCall.name
  }

  function getToolDisplaySummary(toolCall: ToolCall) {
    const items = Array.isArray(toolCall.toolDisplay?.items) ? toolCall.toolDisplay.items : []
    if (toolCall.status === 'running') return '工具执行中...'
    if (items.length > 0) return `已返回 ${items.length} 条结果`
    return '工具执行完成'
  }

  const handleUploadFile = () => {
    fileInputRef.current?.click()
  }

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

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  useEffect(() => {
    if (state?.generatedTemplate && !messageShownRef.current) {
      messageShownRef.current = true
      const template = state.generatedTemplate
      setAgentName(template.agentName || '未命名智能体')
      setAgentSubtitle(template.description || '')
      setAgentInstruction(template.agentPrompt || '')
      setAgentQuestions(template.presetQuestions || [])
      // 创建页现在只在推荐完成后进入，这里直接落推荐结果，不再补推荐中态。
      setRecommendedSkills(template.recommendedSkills ?? [])
      message.success('智能体配置已自动生成，请检查并完善后发布')
    }
  }, [state])

  useEffect(() => {
    loadCustomAgentApiConfig().then(setAgentConfig).catch(console.error)
  }, [])

  const getAvatarLetter = (name: string) => {
    return name?.trim().charAt(0).toUpperCase() || 'A'
  }

  const handleEditClick = () => {
    setModalVisible(true)
  }

  const handleModalCancel = () => {
    setModalVisible(false)
  }

const handleModalSave = (data: { name: string; description: string }) => {
    setAgentName(data.name)
    setAgentSubtitle(data.description)
    setModalVisible(false)
    setPublishStatus('idle')
  }

  const handleOpenSkillModal = () => {
    setSkillModalVisible(true)
  }

  const handleSkillModalCancel = () => {
    setSkillModalVisible(false)
  }

  const handleSkillChange = (skills: EnabledSkill[]) => {
    setAgentSkills(skills)
    setPublishStatus('idle')
  }

  const handleSuggestionClick = useCallback((question: string) => {
    setDraft(question)
  }, [])

  const handleSend = useCallback(async () => {
    const prompt = draft.trim()
    if (!prompt || isResponding || !agentConfig) return

    setDraft('')
    setIsResponding(true)
    setRequestError('')
    abortControllerRef.current = new AbortController()

    const now = new Date()
    const timestamp = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const userMessage: ChatMessage = {
      id: `user-${now.getTime()}`,
      role: 'user',
      content: prompt,
      timestamp,
      toolCalls: [],
      references: [],
      courses: [],
      skillOutput: [],
      reasoningContent: null,
    }
    const assistantMessage: ChatMessage = {
      id: `assistant-${now.getTime()}`,
      role: 'assistant',
      content: '',
      timestamp,
      loading: true,
      toolCalls: [],
      references: [],
      courses: [],
      skillOutput: [],
      reasoningContent: null,
    }

    const nextMessages = [...messagesRef.current, userMessage, assistantMessage]
    messagesRef.current = nextMessages
    setMessages(nextMessages)

    try {
      await chatCustomAgentStream(agentConfig, {
        agent_name: agentName,
        agent_prompt: agentInstruction,
        description: agentSubtitle,
        message: prompt,
        history: messagesRef.current
          .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.loading))
          .map((m) => ({ role: m.role, content: m.content })),
        enabled_skills: agentSkills,
        resource_ids: resourceIds,
        enable_web_search: webSearchEnabled,
      }, abortControllerRef.current.signal, {
        onChatModelStart: () => {
          setMessages((prev) => {
            const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
            return prev.map((m) => {
              if (m.id !== assistantMessage.id) return m
              return { ...m, timestamp: replyTime, content: m.content || '', loading: false }
            })
          })
        },
        onTextDelta: (text) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMessage.id) return m
            return { ...m, content: m.content + text }
          }))
        },
        onReasoningDelta: (text) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMessage.id) return m
            return { ...m, reasoningContent: (m.reasoningContent ?? '') + text }
          }))
        },
        onToolStart: (toolCall: ToolCall) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMessage.id) return m
            const toolCalls = m.toolCalls ?? []
            return { ...m, toolCalls: [...toolCalls, { ...toolCall, status: 'running' as const }] }
          }))
        },
        onToolEnd: (toolCall: ToolCall) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMessage.id) return m
            return {
              ...m,
              toolCalls: (m.toolCalls ?? []).map((tc) =>
                tc.runId === toolCall.runId ? { ...tc, ...toolCall, status: 'completed' as const } : tc,
              ),
            }
          }))
        },
        onReferences: (references: ChatReference[]) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMessage.id) return m
            return { ...m, references }
          }))
        },
        onSkillOutput: (skillOutput: SkillOutputItem[]) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMessage.id) return m
            return { ...m, skillOutput }
          }))
        },
        onComplete: () => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMessage.id) return m
            const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
            return { ...m, loading: false, timestamp: replyTime }
          }))
          setIsResponding(false)
        },
        onError: (error) => {
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantMessage.id) return m
            const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
            return { ...m, content: m.content || '请求失败，请稍后重试。', loading: false, timestamp: replyTime }
          }))
          setIsResponding(false)
          setRequestError(error.message)
        },
      })
    } catch (error) {
      if (!abortControllerRef.current?.signal.aborted) {
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantMessage.id) return m
          const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
          return { ...m, content: m.content || '请求失败，请稍后重试。', loading: false, timestamp: replyTime }
        }))
        setIsResponding(false)
        setRequestError(error instanceof Error ? error.message : '请求失败')
      }
    }
  }, [draft, isResponding, agentConfig, agentName, agentInstruction, agentSubtitle, agentSkills, resourceIds, webSearchEnabled])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setMessages((prev) => prev.map((m) =>
      m.loading ? { ...m, loading: false } : m,
    ))
    setIsResponding(false)
  }, [])

  const handlePublish = async () => {
    if (!agentName.trim()) {
      message.error('智能体名称不能为空')
      return
    }

    if (!agentInstruction.trim()) {
      message.error('指令不能为空')
      return
    }

    const emptyQuestions = agentQuestions.filter((q) => !q.question || !q.instruction)
    if (emptyQuestions.length > 0) {
      const emptyIndexes = agentQuestions
        .map((q, i) => (!q.question || !q.instruction) ? i + 1 : null)
        .filter((i): i is number => i !== null)
      message.error(`问题${emptyIndexes.join('、')}的名称或指令不能为空，请填写完整后再发布`)
      return
    }

    setPublishing(true)
    setPublishStatus('idle')

    try {
      const config = await loadCustomAgentApiConfig()
      
      const payload = {
        agent_name: agentName,
        agent_prompt: agentInstruction,
        avatar_url: 'https://example.com/avatar.png',
        description: agentSubtitle,
        enable_web_search: webSearchEnabled,
        enabled_skills: agentSkills,
        is_public: isPublic,
        preset_questions: agentQuestions,
        resource_ids: resourceIds,
      }

      const response = await createCustomAgent(config, payload)
      
      if (response.success && response.data?.agent_id) {
        setPublishStatus('success')
        message.success('智能体发布成功！')
        
        setTimeout(() => {
          navigate(`/agent/${response.data!.agent_id}`)
        }, 1500)
      } else {
        throw new Error(response.message || '发布失败')
      }
    } catch (error) {
      setPublishStatus('error')
      message.error(error instanceof Error ? error.message : '发布失败，请重试')

      setTimeout(() => {
        setPublishStatus('idle')
      }, 3000)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.layout} ${artifactOpen ? styles.layoutArtifactOpen : ''}`}>
        <main className={styles.chatPanel}>
          <div className={styles.chatPanelInner}>
            <div className={styles.chatHeader}>
              <h2 className={styles.chatHeading}>测试与预览</h2>
            </div>

            <div className={styles.messagesArea} style={{ padding: '16px 0' }}>
              {messages.length === 0 ? (
                <div className={styles.heroSection}>
                  <div className={styles.heroCard}>
                    <div className={styles.heroAvatar}>
                      <span className={styles.avatarLetter}>{getAvatarLetter(agentName)}</span>
                    </div>
                    <div className={styles.heroContent}>
                      <span className={styles.heroTitleWrap}>
                        <h1 className={styles.heroTitle}>{agentName}</h1>
                        <EditOutlined className={styles.heroEditIcon} onClick={handleEditClick} />
                      </span>
                      <p className={styles.heroSubtitle}>{agentSubtitle || '请在右侧配置智能体信息'}</p>
                    </div>
                  </div>

                  {agentQuestions.filter(q => q.question).length > 0 && (
                    <div className={styles.suggestionSection}>
                      <h3 className={styles.suggestionTitle}>你可以问我</h3>
                      <div className={styles.suggestionList}>
                        {agentQuestions.filter(q => q.question).slice(0, 4).map((item, index) => (
                          <button
                            key={index}
                            type="button"
                            className={styles.suggestionItem}
                            onClick={() => handleSuggestionClick(item.instruction || item.question)}
                          >
                            {item.question}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={chatStyles.messageColumn}
                  style={{ maxWidth: 780, margin: '0 auto' }}
                >
                  <MessageList
                    groups={groupedMessages}
                    copiedMessageId={copiedMessageId}
                    assistantCopyTargets={assistantCopyTargets}
                    onCopy={handleCopy}
                    getToolDisplayTitle={getToolDisplayTitle}
                    getToolDisplaySummary={getToolDisplaySummary}
                    onOpenFile={handleOpenFile}
                  />
                  {isResponding && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
                    <div className={styles.assistantMessage}>
                      <div className={styles.assistantBubble}>思考中...</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.composerArea}>
              <div className={styles.composerWrap}>
                <ChatComposer
                  variant="agentConversation"
                  value={draft}
                  onChange={setDraft}
                  onSend={handleSend}
                  placeholder="输入问题进行测试..."
                  uploadedFiles={uploadedFiles}
                  onRemoveFile={handleRemoveFile}
                  fileInputRef={fileInputRef}
                  onFileChange={handleFileChange}
                  onUploadFile={handleUploadFile}
                  webSearchEnabled={webSearchEnabled}
                  knowledgeEnabled={false}
                  onToggleWebSearch={() => {}}
                  onToggleKnowledge={() => {}}
                  sendDisabled={!draft.trim()}
                  isResponding={isResponding}
                  onStop={handleStop}
                  showUpload={false}
                  slashCommandOpen={false}
                  slashQuery=""
                  onSlashQueryChange={() => {}}
                  skills={[]}
                  filteredSkills={[]}
                  skillsLoading={false}
                  selectedSkillIndex={0}
                  onSelectSkill={() => {}}
                  onCloseSlashCommand={() => {}}
                  onManageSkills={() => {}}
                />
              </div>
              <div className={styles.footerHint}>{requestError || 'AI 生成内容可能有误，请核实重要信息'}</div>
            </div>
          </div>
        </main>

        <aside className={styles.configPanel}>
          <div className={styles.configPanelInner}>
            <div className={styles.configPanelHeader}>
              <h2 className={styles.configHeading}>搭建</h2>
              <Tooltip title="只有点击发布后才会保存个人智能体配置" placement="bottom" overlayInnerStyle={{ backgroundColor: '#000', color: '#fff' }}>
                <button
                  type="button"
                  className={`${styles.publishButton} ${publishStatus === 'success' ? styles.publishSuccess : ''} ${publishStatus === 'error' ? styles.publishError : ''}`}
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? (
                    <>
                      <LoadingOutlined spin /> 发布中
                    </>
                  ) : publishStatus === 'success' ? (
                    <>
                      <CheckCircleOutlined /> 发布成功
                    </>
                  ) : publishStatus === 'error' ? (
                    <>
                      <CloseCircleOutlined /> 发布失败
                    </>
                  ) : (
                    '发布'
                  )}
                </button>
              </Tooltip>
            </div>

            <ConfigCard icon={null} title="指令">
              <textarea
                className={styles.instructionBox}
                value={agentInstruction}
                onChange={(e) => {
                  setAgentInstruction(e.target.value)
                  setPublishStatus('idle')
                }}
                placeholder="请输入智能体的指令内容..."
              />
            </ConfigCard>

            <ConfigCard
              icon={null}
              title="Skills 服务"
              extra={
                <button type="button" className={styles.linkAction} onClick={handleOpenSkillModal}>
                  <PlusOutlined /> 添加
                </button>
              }
            >
              <p className={styles.cardHint}>添加 Skills 服务后，可见范围内的用户均可在对话中使用该 Skills 服务</p>
              <div className={styles.serviceList}>
                {agentSkills.map((skill) => {
                  const isExpanded = expandedSkillName === skill.skill_name
                  return (
                    <div
                      key={skill.skill_name}
                      className={styles.serviceCard}
                      onMouseEnter={() => setHoveredSkillName(skill.skill_name)}
                      onMouseLeave={() => setHoveredSkillName(null)}
                    >
                      <div className={styles.serviceHeader}>
                        <div
                          className={styles.serviceClickableArea}
                          onClick={() => {
                            setExpandedSkillName(isExpanded ? null : skill.skill_name)
                          }}
                        >
                          <div className={styles.serviceIconWrap}>
                            <SafetyCertificateOutlined />
                          </div>
                          <div className={styles.serviceContent}>
                            <div className={styles.serviceTopLine}>
                              <span className={styles.serviceName}>{skill.chinese_name}</span>
                              <span className={styles.serviceBadge}>官方</span>
                              <span className={`${styles.serviceArrow} ${isExpanded ? styles.serviceArrowExpanded : ''}`}>›</span>
                            </div>
                            {hoveredSkillName === skill.skill_name && !isExpanded && (
                              <div className={styles.serviceTooltip}>
                                {skill.description || `支持${skill.chinese_name}相关功能`}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={styles.serviceActions}>
                          <button
                            type="button"
                            className={styles.useSkillBtn}
                            onClick={() => {
                              const normalizedSkillName = skill.skill_name.trim().replace(/^\/+/, '')
                              const skillPrefix = normalizedSkillName ? `/${normalizedSkillName}` : ''
                              if (skill.template && skillPrefix) {
                                setDraft(`基于 ${skillPrefix} ${skill.template}`)
                              } else if (skill.template) {
                                setDraft(skill.template)
                              } else if (skillPrefix) {
                                setDraft(skillPrefix)
                              }
                            }}
                          >
                            使用
                          </button>
                          <button
                            type="button"
                            className={styles.smallIconButton}
                            onClick={() => {
                              setAgentSkills(agentSkills.filter((s) => s.skill_name !== skill.skill_name))
                              if (expandedSkillName === skill.skill_name) {
                                setExpandedSkillName(null)
                              }
                              setPublishStatus('idle')
                            }}
                            aria-label="删除"
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      </div>
                       {isExpanded && (
                        <div className={styles.serviceBody}>
                          <SkillDetailPanel
                            visible={true}
                            skillName={skill.skill_name}
                            source={skill.source}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ConfigCard>

            <ConfigCard icon={null} title="知识配置">
              <div className={styles.toggleItem}>
                <div className={styles.toggleLabelWrap}>
                  <GlobalOutlined />
                  <span>联网检索</span>
                </div>
                <span
                  className={`${styles.switch} ${webSearchEnabled ? styles.switchOn : ''}`}
                  onClick={() => {
                    setWebSearchEnabled(!webSearchEnabled)
                    setPublishStatus('idle')
                  }}
                >
                  <span className={styles.switchHandle} />
                </span>
              </div>

              <div className={styles.knowledgeCard}>
                <div className={styles.toggleItem}>
                  <div className={styles.toggleLabelWrap}>
                    <CameraOutlined />
                    <span>知识空间</span>
                  </div>
                  <span
                    className={`${styles.switch} ${knowledgeSpaceEnabled ? styles.switchOn : ''}`}
                    onClick={() => {
                      setKnowledgeSpaceEnabled(!knowledgeSpaceEnabled)
                      setPublishStatus('idle')
                    }}
                  >
                    <span className={styles.switchHandle} />
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.knowledgeButton}
                  onClick={() => {
                    setKnowledgeModalVisible(true)
                  }}
                >
                  <PlusOutlined /> 关联知识空间
                </button>
                {resourceIds.length > 0 && (
                  <div className={styles.resourceList}>
                    {resourceIds.map((id) => (
                      <div key={id} className={styles.resourceItem}>
                        <span className={styles.resourceId}>{id}</span>
                        <button
                          type="button"
                          className={styles.removeResourceBtn}
                          onClick={() => {
                            setResourceIds(resourceIds.filter((r) => r !== id))
                            setPublishStatus('idle')
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ConfigCard>

            <ConfigCard
              icon={null}
              title="对话配置"
              extra={
                <button
                  type="button"
                  className={styles.linkAction}
                  onClick={() => {
                    setAgentQuestions([...agentQuestions, { category: '默认', question: '', instruction: '' }])
                    setPublishStatus('idle')
                  }}
                >
                  <PlusOutlined /> 添加
                </button>
              }
            >
              <div className={styles.dialogConfigBlock}>
                <div className={styles.dialogLabel}>推荐问题</div>
                {agentQuestions.map((item, index: number) => {
                  const isExpanded = expandedQuestionIndex === index
                  const displayName = item.question || `问题${index + 1}`
                  return (
                    <div key={index} className={styles.questionCard}>
                      <div className={styles.questionHeader}>
                        <span className={styles.questionLabel}>
                          {isExpanded ? `问题${index + 1}` : `问题${index + 1}：${displayName}`}
                        </span>
                        <div className={styles.questionActions}>
                          <button
                            type="button"
                            className={`${styles.smallIconButton} ${isExpanded ? styles.questionArrowExpanded : ''}`}
                            onClick={() => setExpandedQuestionIndex(isExpanded ? null : index)}
                            aria-label={isExpanded ? '收起' : '展开'}
                          >
                            ›
                          </button>
                          <button
                            type="button"
                            className={styles.smallIconButton}
                            onClick={() => {
                              setAgentQuestions(agentQuestions.filter((_, i) => i !== index))
                              if (expandedQuestionIndex === index) {
                                setExpandedQuestionIndex(null)
                              }
                              setPublishStatus('idle')
                            }}
                            aria-label="删除"
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className={styles.questionBody}>
                          <div className={styles.questionField}>
                            <label className={styles.fieldLabel}>
                              名称 <span className={styles.required}>*</span>
                            </label>
                            <div className={styles.fieldWithCount}>
                              <input
                                className={`${styles.fieldInput} ${!item.question ? styles.fieldError : ''}`}
                                value={item.question}
                                onChange={(e) => {
                                  const newQuestions = [...agentQuestions]
                                  newQuestions[index] = { ...newQuestions[index], question: e.target.value }
                                  setAgentQuestions(newQuestions)
                                  setPublishStatus('idle')
                                }}
                                maxLength={20}
                                placeholder="请输入"
                              />
                              <span className={styles.charCount}>{item.question.length}/20</span>
                            </div>
                            {!item.question && (
                              <span className={styles.fieldErrorText}>名字不能为空</span>
                            )}
                          </div>
                          <div className={styles.questionField}>
                            <label className={styles.fieldLabel}>
                              指令 <span className={styles.required}>*</span>
                            </label>
<div className={styles.fieldWithCount}>
                               <textarea
                                 className={styles.fieldTextarea}
                                 value={item.instruction || ''}
                                 onChange={(e) => {
                                   const newQuestions = [...agentQuestions]
                                   newQuestions[index] = { ...newQuestions[index], instruction: e.target.value }
                                   setAgentQuestions(newQuestions)
                                   setPublishStatus('idle')
                                 }}
                                 maxLength={1000}
                                 placeholder="请输入指令内容"
                                 rows={4}
                               />
                               <span className={styles.charCount}>{(item.instruction || '').length}/1000</span>
                             </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ConfigCard>

            <ConfigCard icon={null} title="发布设置">
              <div className={styles.toggleItem}>
                <div className={styles.toggleLabelWrap}>
                  <span>公开智能体</span>
                </div>
                <span
                  className={`${styles.switch} ${isPublic ? styles.switchOn : ''}`}
                  onClick={() => {
                    setIsPublic(!isPublic)
                    setPublishStatus('idle')
                  }}
                >
                  <span className={styles.switchHandle} />
                </span>
              </div>
              <p className={styles.cardHint}>开启后，其他用户可以在发现页看到并使用该智能体</p>
            </ConfigCard>
          </div>
        </aside>
        {artifactOpen && selectedFile && (
          <aside className={`${styles.artifactPanel} ${styles.artifactPanelOpen}`}>
            <ArtifactFileDetail file={selectedFile} />
          </aside>
        )}
      </div>

      <EditAgentModal
        visible={modalVisible}
        name={agentName}
        description={agentSubtitle}
        onCancel={handleModalCancel}
        onSave={handleModalSave}
      />

      <SkillConfigModal
        visible={skillModalVisible}
        onCancel={handleSkillModalCancel}
        onSkillChange={handleSkillChange}
        currentSkills={agentSkills}
        recommendedSkills={recommendedSkills}
      />

      <KnowledgeSpaceModal
        visible={knowledgeModalVisible}
        onCancel={() => setKnowledgeModalVisible(false)}
        onConfirm={(selectedIds: string[]) => {
          setResourceIds(selectedIds)
          setKnowledgeModalVisible(false)
          setPublishStatus('idle')
        }}
        currentResourceIds={resourceIds}
      />
    </div>
  )
}
