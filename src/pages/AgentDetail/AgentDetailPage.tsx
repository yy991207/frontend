import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  AppstoreAddOutlined,
  CameraOutlined,
  EditOutlined,
  EyeOutlined,
  GlobalOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SoundOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons'
import { message, Spin } from 'antd'
import EditAgentModal from '../../components/common/EditAgentModal'
import SkillConfigModal from '../../components/common/SkillConfigModal'
import KnowledgeSpaceModal from '../../components/common/KnowledgeSpaceModal'
import SkillDetailModal from '../../components/common/SkillDetailModal'
import { MessageList } from '../../components/chat/message-list'
import {
  loadCustomAgentApiConfig,
  updateCustomAgent,
  viewCustomAgent,
  chatCustomAgentStream,
  type AgentDetail,
  type EnabledSkill,
  type ChatMessageItem,
} from '../../services/customAgentService'
import type { ToolCall } from '../../core/messages/types'
import {
  saveAgentConfig,
  saveChatHistory,
  type AgentLocalConfig,
  type ChatHistoryItem,
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
}: {
  icon?: React.ReactNode
  title: string
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <section className={styles.configCard}>
      <div className={styles.configCardHeader}>
        <div className={styles.configCardTitleWrap}>
          <span className={styles.configCardArrow}>▾</span>
          {icon ? <span className={styles.configCardIcon}>{icon}</span> : null}
          <h4 className={styles.configCardTitle}>{title}</h4>
        </div>
        {extra ? <div className={styles.configCardExtra}>{extra}</div> : null}
      </div>
      <div className={styles.configCardBody}>{children}</div>
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
  const [agentQuestions, setAgentQuestions] = useState<{ category: string; question: string }[]>([])
  const [expandedQuestionIndex, setExpandedQuestionIndex] = useState<number | null>(null)
  const [chatInputValue, setChatInputValue] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [resourceIds, setResourceIds] = useState<string[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [skillModalVisible, setSkillModalVisible] = useState(false)
  const [knowledgeModalVisible, setKnowledgeModalVisible] = useState(false)
  const [skillDetailVisible, setSkillDetailVisible] = useState(false)
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle')
  // 知识配置开关状态
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [knowledgeSpaceEnabled, setKnowledgeSpaceEnabled] = useState(false)
  
  // 聊天预览相关状态
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>([])
  const [isChatResponding, setIsChatResponding] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
  }, [id])

  // 所有的Hooks必须在early return之前调用
  const avatarUrl = agentData?.avatar_url
    ? agentData.avatar_url.startsWith('http')
      ? agentData.avatar_url
      : `http://192.168.30.238:8000${agentData.avatar_url}`
    : ''

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

  // 聊天消息变化时自动保存到本地存储
  useEffect(() => {
    if (!id || chatMessages.length === 0) return
    
    const history: ChatHistoryItem[] = chatMessages
      .filter((msg) => {
        if (msg.role === 'user') return Boolean(msg.content.trim())
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
    
    saveChatHistory(id, history)
  }, [id, chatMessages])

  // 处理发送消息 - 调用真实API
  const handleSendMessage = useCallback(async () => {
    const content = chatInputValue.trim()
    if (!content || isChatResponding) return

    const timestamp = formatTime(new Date())
    const userMessage = createUserMessage(content, timestamp)

    // 添加用户消息
    setChatMessages((prev) => [...prev, userMessage])
    setChatInputValue('')
    setIsChatResponding(true)

    const assistantMessageId = `assistant-${Date.now()}`
    const initialAssistantMessage = createLoadingAssistantMessage(timestamp, assistantMessageId)
    setChatMessages((prev) => [...prev, initialAssistantMessage])

    try {
      const config = await loadCustomAgentApiConfig()
      
      // 构建历史消息
      const history: ChatMessageItem[] = chatMessages
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
      let activeAssistantMessageId = assistantMessageId

      await chatCustomAgentStream(config, payload, controller.signal, {
        onChatModelStart: () => {
          const replyTime = formatTime(new Date())
          setChatMessages((prev) => {
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
        onReasoningDelta: (text: string) => {
          setChatMessages((prev) =>
            updateAssistantMessageById(prev, activeAssistantMessageId, (msg) => ({
              ...msg,
              reasoningContent: `${msg.reasoningContent ?? ''}${text}`,
            })),
          )
        },
        onTextDelta: (text: string) => {
          const replyTime = formatTime(new Date())
          setChatMessages((prev) => {
            const result = appendTextDeltaToStreamMessages(
              prev,
              activeAssistantMessageId,
              text,
              replyTime,
              createFollowupAssistantMessage,
            )
            activeAssistantMessageId = result.activeMessageId
            return result.messages
          })
        },
        onToolCall: (toolCall) => {
          const toolCallData: ToolCall = {
            name: toolCall.name,
            runId: `${toolCall.name}-${Date.now()}`,
            status: toolCall.status,
            input: (toolCall.input as Record<string, unknown>) ?? {},
            output: toolCall.output,
          }
          setChatMessages((prev) =>
            updateAssistantMessageById(prev, activeAssistantMessageId, (msg) =>
              upsertToolCall(msg, toolCallData),
            ),
          )
        },
        onComplete: () => {
          setChatMessages((prev) =>
            updateAssistantMessageById(prev, activeAssistantMessageId, (msg) => ({
              ...msg,
              loading: false,
            })),
          )
          setIsChatResponding(false)
        },
        onError: (error) => {
          setChatMessages((prev) =>
            updateAssistantMessageById(prev, activeAssistantMessageId, (msg) => ({
              ...msg,
              content: msg.content || `请求失败: ${error.message}`,
              loading: false,
            })),
          )
          setIsChatResponding(false)
        },
      })
    } catch (error) {
      setChatMessages((prev) =>
        updateAssistantMessageById(prev, assistantMessageId, (msg) => ({
          ...msg,
          content: msg.content || `请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
          loading: false,
        })),
      )
      setIsChatResponding(false)
    }
  }, [chatInputValue, isChatResponding, chatMessages, agentName, agentInstruction, agentSubtitle, agentSkills, resourceIds, webSearchEnabled])

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

  // 处理键盘事件 - 支持中文输入法，composition期间不发送
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 中文输入法composition期间不触发发送
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

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

      const localConfig: AgentLocalConfig = {
        agent_id: agentData.agent_id,
        agent_name: agentName,
        agent_prompt: agentInstruction,
        description: agentSubtitle,
        enable_web_search: webSearchEnabled,
        enabled_skills: agentSkills,
        resource_ids: resourceIds,
        chat_history: chatMessages
          .filter((msg) => {
            if (msg.role === 'user') return Boolean(msg.content.trim())
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
          })),
        updated_at: Date.now(),
      }
      saveAgentConfig(localConfig)
      saveChatHistory(agentData.agent_id, localConfig.chat_history)

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
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.topTitle}>{agentName}</span>
          <EditOutlined className={styles.topEditIcon} onClick={handleEditClick} />
        </div>

        <div className={styles.topBarRight}>
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
        </div>
      </div>

      <div className={styles.layout}>
        <main className={styles.chatPanel}>
          <div className={styles.chatPanelInner}>
            <div className={styles.chatHeader}>
              <h2 className={styles.chatHeading}>测试与预览</h2>
              <button type="button" className={styles.previewButton} aria-label="预览设置">
                <EyeOutlined />
              </button>
            </div>

            {/* 消息区域 */}
            <div className={styles.messagesArea}>
              {/* 初始欢迎区域 - 仅在没有消息时显示 */}
              {chatMessages.length === 0 && (
                <div className={styles.heroSection}>
                  <div className={styles.heroCard}>
                    <img className={styles.heroAvatar} src={avatarUrl} alt={agentName} />
                    <div className={styles.heroContent}>
                      <h1 className={styles.heroTitle}>{agentName}</h1>
                      <p className={styles.heroSubtitle}>{agentSubtitle}</p>
                    </div>
                  </div>

                  <div className={styles.suggestionSection}>
                    <h3 className={styles.suggestionTitle}>推荐问题</h3>
                    <div className={styles.suggestionList}>
                      {agentQuestions.slice(0, 3).map((item) => (
                        <button
                          key={item.question}
                          type="button"
                          className={styles.suggestionChip}
                          onClick={() => handleSuggestionClick(item.category)}
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
            <div className={styles.chatComposerWrap}>
              <div className={styles.chatComposer}>
                <input
                  className={styles.chatInput}
                  value={chatInputValue}
                  onChange={(e) => setChatInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="问我任何问题"
                  aria-label="对话输入框"
                />

                <div className={styles.chatToolsRow}>
                  <div className={styles.leftTools}>
                    <button type="button" className={styles.toolPill}>
                      <SoundOutlined />
                      深度规划
                    </button>
                    <button type="button" className={`${styles.toolPill} ${styles.toolPillActive}`}>
                      <GlobalOutlined />
                      联网
                    </button>
                    <button type="button" className={styles.toolPill}>
                      <AppstoreAddOutlined />
                      工具
                      <span className={styles.toolCaret}>⌄</span>
                    </button>
                  </div>

                  <div className={styles.rightTools}>
                    <button type="button" className={styles.iconButton} aria-label="附件">
                      <PaperClipOutlined />
                    </button>
                    <button type="button" className={styles.iconButton} aria-label="语音">
                      <SoundOutlined />
                    </button>
                    <div className={styles.divider} />
                    <button
                      type="button"
                      className={`${styles.sendButton} ${chatInputValue.trim() && !isChatResponding ? styles.sendButtonActive : styles.sendButtonDisabled}`}
                      onClick={handleSendMessage}
                      disabled={!chatInputValue.trim() || isChatResponding}
                      aria-label="发送消息"
                    >
                      {isChatResponding ? <LoadingOutlined spin /> : <ArrowUpOutlined />}
                    </button>
                  </div>
                </div>
              </div>

              <p className={styles.disclaimer}>AI 生成内容可能有误，请核实重要信息</p>
            </div>
          </div>
        </main>

        <aside className={styles.configPanel}>
          <div className={styles.configPanelInner}>
            <h2 className={styles.configHeading}>搭建</h2>

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
                {agentSkills.map((skill) => (
                  <div
                    key={skill.skill_name}
                    className={styles.serviceCard}
                    onMouseEnter={() => setHoveredSkillName(skill.skill_name)}
                    onMouseLeave={() => setHoveredSkillName(null)}
                  >
                    <div
                      className={styles.serviceClickableArea}
                      onClick={() => {
                        setSelectedSkillName(skill.skill_name)
                        setSkillDetailVisible(true)
                      }}
                    >
                      <div className={styles.serviceIconWrap}>
                        <SafetyCertificateOutlined />
                      </div>
                      <div className={styles.serviceContent}>
                        <div className={styles.serviceTopLine}>
                          <span className={styles.serviceName}>{skill.chinese_name}</span>
                          <span className={styles.serviceBadge}>官方</span>
                          <span className={styles.serviceArrow}>›</span>
                        </div>
                        {hoveredSkillName === skill.skill_name && (
                          <div className={styles.serviceTooltip}>
                            {skill.description || `支持${skill.chinese_name}相关功能`}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.serviceDeleteBtn}
                      onClick={() => {
                        setAgentSkills(agentSkills.filter((s) => s.skill_name !== skill.skill_name))
                        setPublishStatus('idle')
                      }}
                    >
                      <DeleteOutlined />
                    </button>
                  </div>
                ))}
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
                    setAgentQuestions([...agentQuestions, { category: '默认', question: '' }])
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
                    <div key={`${item.question}-${index}`} className={styles.questionCard}>
                      <div className={styles.questionHeader}>
                        <span className={styles.questionLabel}>
                          {isExpanded ? `问题${index + 1}` : `问题${index + 1}：${displayName}`}
                        </span>
                        <div className={styles.questionActions}>
                          <button
                            type="button"
                            className={styles.smallIconButton}
                            onClick={() => setExpandedQuestionIndex(isExpanded ? null : index)}
                            aria-label={isExpanded ? '收起' : '展开'}
                          >
                            {isExpanded ? '⌃' : '⌄'}
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
                                value={item.category}
                                onChange={(e) => {
                                  const newQuestions = [...agentQuestions]
                                  newQuestions[index] = { ...newQuestions[index], category: e.target.value }
                                  setAgentQuestions(newQuestions)
                                  setPublishStatus('idle')
                                }}
                                maxLength={1000}
                                placeholder="请输入指令内容"
                                rows={4}
                              />
                              <span className={styles.charCount}>{item.category.length}/1000</span>
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
        avatar={avatarUrl}
        onCancel={handleModalCancel}
        onSave={handleModalSave}
      />

      <SkillConfigModal
        visible={skillModalVisible}
        onCancel={handleSkillModalCancel}
        onSkillChange={handleSkillChange}
        currentSkills={agentSkills}
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

      <SkillDetailModal
        visible={skillDetailVisible}
        skillName={selectedSkillName}
        onCancel={() => setSkillDetailVisible(false)}
      />
    </div>
  )
}
