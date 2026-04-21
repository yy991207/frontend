import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  CameraOutlined,
  EditOutlined,
  GlobalOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { message, Spin, Tooltip } from 'antd'
import EditAgentModal from '../../components/common/EditAgentModal'
import SkillConfigModal from '../../components/common/SkillConfigModal'
import KnowledgeSpaceModal from '../../components/common/KnowledgeSpaceModal'
import SkillDetailPanel from '../../components/common/SkillDetailPanel'
import { MessageList } from '../../components/chat/message-list'
import {
  loadCustomAgentApiConfig,
  updateCustomAgent,
  viewCustomAgent,
  chatCustomAgentStream,
  type AgentDetail,
  type EnabledSkill,
  type ChatMessageItem,
  type PresetQuestion,
  type RecommendSkillsRequest,
} from '../../services/customAgentService'
import {
  createPendingUploadedFile,
  type UploadedFile,
} from '../../services/ossUploadService'
import { uploadPendingFileToOssWithDocumentParse } from '../../services/agentFileUploadService'
import type { ToolCall } from '../../core/messages/types'
import { ChatComposer } from '../../components/common/ChatComposer'
import {
  clearAgentStorage,
} from '../../utils/agentStorage'
import {
  createUserMessage,
  createLoadingAssistantMessage,
  createFollowupAssistantMessage,
  updateAssistantMessageById,
  upsertToolCall,
  advanceAssistantMessageForNextModelPhase,
  appendTextDeltaToStreamMessages,
  buildMessageGroups,
  buildAssistantCopyTargets,
  getToolDisplayTitle,
  getToolDisplaySummary,
  type AgentChatMessage,
} from './chatMessageAdapter'
import styles from './agentDetail.module.less'

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

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [agentData, setAgentData] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [agentName, setAgentName] = useState('')
  const [agentSubtitle, setAgentSubtitle] = useState('')
  const [agentInstruction, setAgentInstruction] = useState('')
  const [agentSkills, setAgentSkills] = useState<EnabledSkill[]>([])
  const [hoveredSkillName, setHoveredSkillName] = useState<string | null>(null)
  const [agentQuestions, setAgentQuestions] = useState<PresetQuestion[]>([])
  const [expandedQuestionIndex, setExpandedQuestionIndex] = useState<number | null>(null)
  const [chatInputValue, setChatInputValue] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [resourceIds, setResourceIds] = useState<string[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [skillModalVisible, setSkillModalVisible] = useState(false)
  const [knowledgeModalVisible, setKnowledgeModalVisible] = useState(false)
  const [expandedSkillName, setExpandedSkillName] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle')
  // 知识配置开关状态
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [knowledgeSpaceEnabled, setKnowledgeSpaceEnabled] = useState(false)
  
  // 聊天预览相关状态
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>([])
  const [isChatResponding, setIsChatResponding] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const chatMessagesRef = useRef<AgentChatMessage[]>([])
  const activeAssistantMessageIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatAbortControllerRef = useRef<AbortController | null>(null)
  
  // 上传文件相关状态
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const commitChatMessages = useCallback((nextMessages: AgentChatMessage[]) => {
    chatMessagesRef.current = nextMessages
    setChatMessages(nextMessages)
  }, [])

  const handleUploadFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
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
    let cancelled = false

    async function fetchAgentDetail() {
      if (!id) {
        setError('智能体ID不能为空')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setAgentData(null)
      setChatInputValue('')
      setIsChatResponding(false)
      setCopiedMessageId(null)
      setExpandedQuestionIndex(null)
      setExpandedSkillName(null)
      setHoveredSkillName(null)
      setPublishStatus('idle')
      activeAssistantMessageIdRef.current = null
      commitChatMessages([])
      clearAgentStorage(id)

      try {
        const config = await loadCustomAgentApiConfig()
        const agent = await viewCustomAgent(config, id)

        if (!cancelled) {
          setAgentData(agent)
          setAgentName(agent.agent_name)
          setAgentSubtitle(agent.description)
          setAgentInstruction(agent.agent_prompt)
          setAgentSkills(agent.enabled_skills || [])
          setAgentQuestions(agent.preset_questions || [])
          setWebSearchEnabled(agent.enable_web_search)
          setIsPublic(agent.is_public)
          setResourceIds(agent.resource_ids || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取智能体详情失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAgentDetail()

    return () => {
      cancelled = true
    }
  }, [commitChatMessages, id])

  // 所有的Hooks必须在early return之前调用

  // 获取头像首字母
  const getAvatarLetter = (name: string) => {
    return name?.trim().charAt(0).toUpperCase() || 'A'
  }

  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // 消息变化时自动滚动
  useEffect(() => {
    scrollToBottom()
  }, [chatMessages, scrollToBottom])

  // 处理发送消息 - 调用真实API
  const handleSendMessage = useCallback(async () => {
    const content = chatInputValue.trim()
    if (!content || isChatResponding) return

    const timestamp = formatTime(new Date())
    const previousMessages = chatMessagesRef.current
    const userMessage = createUserMessage(content, timestamp)
    const assistantMessageId = `assistant-${Date.now()}`
    const initialAssistantMessage = createLoadingAssistantMessage(timestamp, assistantMessageId)
    const nextMessages = [...previousMessages, userMessage, initialAssistantMessage]

    setChatInputValue('')
    setIsChatResponding(true)
    activeAssistantMessageIdRef.current = assistantMessageId
    commitChatMessages(nextMessages)

    try {
      const config = await loadCustomAgentApiConfig()
      
      // 构建历史消息
      const history: ChatMessageItem[] = previousMessages
        .filter((msg) => {
          if (msg.role === 'user') {
            return Boolean(msg.content.trim())
          }
          if (msg.role === 'assistant') {
            const contentText = msg.content.trim()
            if (!contentText) return false
            if (contentText.startsWith('请求失败:')) return false
            return true
          }
          return false
        })
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

      const payload = {
        agent_name: agentName,
        agent_prompt: agentInstruction,
        description: agentSubtitle,
        message: content,
        history,
        enabled_skills: agentSkills.map((s) => ({
          skill_name: s.skill_name,
          chinese_name: s.chinese_name,
          description: s.description,
        })),
        resource_ids: resourceIds,
        enable_web_search: webSearchEnabled,
      }

      const controller = new AbortController()
      chatAbortControllerRef.current = controller

      await chatCustomAgentStream(config, payload, controller.signal, {
        onChatModelStart: () => {
          const activeAssistantMessageId = activeAssistantMessageIdRef.current ?? assistantMessageId
          const replyTime = formatTime(new Date())
          const result = advanceAssistantMessageForNextModelPhase(
            chatMessagesRef.current,
            activeAssistantMessageId,
            replyTime,
            createFollowupAssistantMessage,
          )
          activeAssistantMessageIdRef.current = result.activeMessageId
          commitChatMessages(result.messages)
        },
        onReasoningDelta: (text: string) => {
          const activeAssistantMessageId = activeAssistantMessageIdRef.current ?? assistantMessageId
          commitChatMessages(
            updateAssistantMessageById(chatMessagesRef.current, activeAssistantMessageId, (msg) => ({
              ...msg,
              reasoningContent: `${msg.reasoningContent ?? ''}${text}`,
            })),
          )
        },
        onTextDelta: (text: string) => {
          const activeAssistantMessageId = activeAssistantMessageIdRef.current ?? assistantMessageId
          const replyTime = formatTime(new Date())
          const result = appendTextDeltaToStreamMessages(
            chatMessagesRef.current,
            activeAssistantMessageId,
            text,
            replyTime,
            createFollowupAssistantMessage,
          )
          activeAssistantMessageIdRef.current = result.activeMessageId
          commitChatMessages(result.messages)
        },
        onToolStart: (toolCall: ToolCall) => {
          const toolMessageId = activeAssistantMessageIdRef.current

          if (!toolMessageId) {
            return
          }

          commitChatMessages(
            updateAssistantMessageById(chatMessagesRef.current, toolMessageId, (msg) =>
              upsertToolCall(msg, toolCall),
            ),
          )
        },
        onToolEnd: (toolCall: ToolCall) => {
          const toolMessageId = activeAssistantMessageIdRef.current

          if (!toolMessageId) {
            return
          }

          commitChatMessages(
            updateAssistantMessageById(chatMessagesRef.current, toolMessageId, (msg) =>
              upsertToolCall(msg, toolCall),
            ),
          )
        },
        onReferences: (references) => {
          const activeAssistantMessageId = activeAssistantMessageIdRef.current ?? assistantMessageId
          commitChatMessages(
            updateAssistantMessageById(chatMessagesRef.current, activeAssistantMessageId, (msg) => ({
              ...msg,
              references,
            })),
          )
        },
        onSkillOutput: (skillOutput) => {
          const activeAssistantMessageId = activeAssistantMessageIdRef.current ?? assistantMessageId
          commitChatMessages(
            updateAssistantMessageById(chatMessagesRef.current, activeAssistantMessageId, (msg) => ({
              ...msg,
              skillOutput,
            })),
          )
        },
        onComplete: () => {
          const activeAssistantMessageId = activeAssistantMessageIdRef.current ?? assistantMessageId
          commitChatMessages(
            updateAssistantMessageById(chatMessagesRef.current, activeAssistantMessageId, (msg) => ({
              ...msg,
              loading: false,
            })),
          )
          activeAssistantMessageIdRef.current = null
          setIsChatResponding(false)
          chatAbortControllerRef.current = null
        },
        onError: (error) => {
          const activeAssistantMessageId = activeAssistantMessageIdRef.current ?? assistantMessageId
          commitChatMessages(
            updateAssistantMessageById(chatMessagesRef.current, activeAssistantMessageId, (msg) => ({
              ...msg,
              content: msg.content || `请求失败: ${error.message}`,
              loading: false,
            })),
          )
          activeAssistantMessageIdRef.current = null
          setIsChatResponding(false)
          chatAbortControllerRef.current = null
        },
      })
    } catch (error) {
      commitChatMessages(
        updateAssistantMessageById(chatMessagesRef.current, assistantMessageId, (msg) => ({
          ...msg,
          content: msg.content || `请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
          loading: false,
        })),
      )
      activeAssistantMessageIdRef.current = null
      setIsChatResponding(false)
      chatAbortControllerRef.current = null
    }
  }, [agentInstruction, agentName, agentSkills, agentSubtitle, chatInputValue, commitChatMessages, isChatResponding, resourceIds, webSearchEnabled])

  // 停止生成
  const handleStop = useCallback(() => {
    chatAbortControllerRef.current?.abort()
    chatAbortControllerRef.current = null
    setIsChatResponding(false)
  }, [])

  const handleStartNewSession = useCallback(() => {
    chatAbortControllerRef.current?.abort()
    chatAbortControllerRef.current = null
    activeAssistantMessageIdRef.current = null
    setIsChatResponding(false)
    setChatInputValue('')
    setCopiedMessageId(null)
    commitChatMessages([])
    if (id) {
      clearAgentStorage(id)
    }
  }, [commitChatMessages, id])

  // 消息分组和复制目标（复用 ChatPage 的渲染逻辑）
  const groupedMessages = useMemo(() => buildMessageGroups(chatMessages), [chatMessages])
  const assistantCopyTargets = useMemo(() => buildAssistantCopyTargets(chatMessages), [chatMessages])

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch {
      // 剪贴板不可用，忽略
    }
  }, [])

  // 处理推荐问题点击
  const handleSuggestionClick = useCallback((question: string) => {
    setChatInputValue(question)
  }, [])

  // 事件处理函数
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

  const handlePublish = async () => {
    if (!agentData) return

    // 验证推荐问题必填项
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
        avatar_url: agentData.avatar_url,
        description: agentSubtitle,
        enabled_skills: agentSkills.map((s) => ({ skill_name: s.skill_name })),
        is_public: isPublic,
        preset_questions: agentQuestions,
        resource_ids: resourceIds,
        enable_web_search: webSearchEnabled,
      }

      const updatedAgent = await updateCustomAgent(config, agentData.agent_id, payload)

      if (updatedAgent) {
        setAgentData(updatedAgent)
        setAgentName(updatedAgent.agent_name)
        setAgentSubtitle(updatedAgent.description)
        setAgentInstruction(updatedAgent.agent_prompt)
        setAgentSkills(updatedAgent.enabled_skills || [])
        setAgentQuestions(updatedAgent.preset_questions || [])
        setIsPublic(updatedAgent.is_public)
        setResourceIds(updatedAgent.resource_ids || [])
      }

      setPublishStatus('success')
      message.success('更新成功')

      setTimeout(() => {
        setPublishStatus('idle')
      }, 3000)
    } catch (error) {
      setPublishStatus('error')
      message.error(error instanceof Error ? error.message : '更新失败，请重试')

      setTimeout(() => {
        setPublishStatus('idle')
      }, 3000)
    } finally {
      setPublishing(false)
    }
  }

  // 缓存 agentInfo，使用本地 state 数据而非接口数据，避免每次渲染创建新对象引用导致 SkillConfigModal 重复请求
  const skillModalAgentInfo = useMemo<RecommendSkillsRequest | undefined>(() =>
    agentName ? {
      agent_name: agentName,
      description: agentSubtitle,
      agent_prompt: agentInstruction || null,
    } : undefined,
  [agentName, agentSubtitle, agentInstruction])

  // 加载状态
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} description="加载中..." />
        </div>
      </div>
    )
  }

  // 错误状态
  if (error || !agentData) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <h2>加载失败</h2>
          <p>{error || '智能体不存在或已被删除'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <main className={styles.chatPanel}>
          <div className={styles.chatPanelInner}>
            <div className={styles.chatHeader}>
              <h2 className={styles.chatHeading}>测试与预览</h2>
              <button
                type="button"
                className={styles.newSessionButton}
                aria-label="新建会话"
                onClick={handleStartNewSession}
              >
                <PlusOutlined />
                新建会话
              </button>
            </div>

            {/* 消息区域 */}
            <div className={styles.messagesArea}>
              {/* 初始欢迎区域 - 仅在没有消息时显示 */}
              {chatMessages.length === 0 && (
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
                      <p className={styles.heroSubtitle}>{agentSubtitle}</p>
                    </div>
                  </div>

                  <div className={styles.suggestionSection}>
                    <h3 className={styles.suggestionTitle}>你可以问我</h3>
                    <div className={styles.suggestionList}>
                      {agentQuestions.filter(q => q.question).slice(0, 4).map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={styles.suggestionItem}
                          onClick={() => handleSuggestionClick(item.instruction || item.question)}
                        >
                          {item.question}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 消息列表 - 复用 ChatPage 的 MessageList 组件 */}
              <div className={styles.messageColumn}>
                <div className={styles.messageList}>
                  <MessageList
                    groups={groupedMessages}
                    threadLoading={false}
                    copiedMessageId={copiedMessageId}
                    assistantCopyTargets={assistantCopyTargets}
                    onCopy={handleCopy}
                    getToolDisplayTitle={getToolDisplayTitle}
                    getToolDisplaySummary={getToolDisplaySummary}
                  />
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {/* 输入区域 */}
            <div className={styles.composerArea}>
              <div className={styles.composerWrap}>
                <ChatComposer
                  variant="agentConversation"
                  value={chatInputValue}
                  onChange={setChatInputValue}
                  onSend={handleSendMessage}
                  placeholder="问我任何问题"
                  uploadedFiles={uploadedFiles}
                  onRemoveFile={handleRemoveFile}
                  fileInputRef={fileInputRef}
                  onFileChange={handleFileChange}
                  onUploadFile={handleUploadFile}
                  webSearchEnabled={webSearchEnabled}
                  webSearchLocked={!webSearchEnabled}
                  knowledgeEnabled={false}
                  onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
                  onLockedWebSearchClick={() => {
                    void message.warning('当前智能体未开启联网检索，无法配置')
                  }}
                  onToggleKnowledge={() => {}}
                  sendDisabled={!chatInputValue.trim()}
                  isResponding={isChatResponding}
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
              <div className={styles.footerHint}>AI 生成内容可能有误，请核实重要信息</div>
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
                              if (skillPrefix && skill.template) {
                                setChatInputValue(`基于 ${skillPrefix} ${skill.template}`)
                              } else if (skill.template) {
                                setChatInputValue(skill.template)
                              } else if (skillPrefix) {
                                setChatInputValue(skillPrefix)
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
                                 value={item.instruction}
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
        agentInfo={skillModalAgentInfo}
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
