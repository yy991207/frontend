import { useState, useEffect, useCallback, useRef } from 'react'
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
  BulbOutlined,
  SearchOutlined,
  CaretUpOutlined,
} from '@ant-design/icons'
import { message, Spin } from 'antd'
import EditAgentModal from '../../components/common/EditAgentModal'
import SkillConfigModal from '../../components/common/SkillConfigModal'
import KnowledgeSpaceModal from '../../components/common/KnowledgeSpaceModal'
import {
  loadCustomAgentApiConfig,
  updateCustomAgent,
  viewCustomAgent,
  chatCustomAgentStream,
  type AgentDetail,
  type EnabledSkill,
  type ChatMessageItem,
} from '../../services/customAgentService'
import styles from './agentDetail.module.less'

// 消息类型定义
type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  thinking?: ThinkingStep[]
  toolCalls?: ToolCall[]
  loading?: boolean
}

type ThinkingStep = {
  id: string
  label: string
  icon: React.ReactNode
  status: 'complete' | 'running'
  results?: string[]
}

type ToolCall = {
  id: string
  name: string
  status: 'running' | 'completed'
  input?: Record<string, unknown>
  output?: unknown
}

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
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle')
  // 知识配置开关状态
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [knowledgeSpaceEnabled, setKnowledgeSpaceEnabled] = useState(false)
  
  // 聊天预览相关状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatResponding, setIsChatResponding] = useState(false)
  const [showThinking, setShowThinking] = useState<Record<string, boolean>>({})
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

  // 处理发送消息 - 调用真实API
  const handleSendMessage = useCallback(async () => {
    const content = chatInputValue.trim()
    if (!content || isChatResponding) return

    const now = new Date()
    const userMessage: ChatMessage = {
      id: `user-${now.getTime()}`,
      role: 'user',
      content,
      timestamp: formatTime(now),
    }

    // 添加用户消息
    setChatMessages((prev) => [...prev, userMessage])
    setChatInputValue('')
    setIsChatResponding(true)

    const assistantMessageId = `assistant-${Date.now()}`
    
    // 创建初始AI消息
    const initialAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: formatTime(new Date()),
      loading: true,
      thinking: [],
      toolCalls: [],
    }
    
    setChatMessages((prev) => [...prev, initialAssistantMessage])

    try {
      // 加载API配置
      const config = await loadCustomAgentApiConfig()
      
      // 构建历史消息 - 从当前对话记录中获取
      const history: ChatMessageItem[] = chatMessages
        .filter((msg) => {
          if (msg.role === 'user') {
            return Boolean(msg.content.trim())
          }

          if (msg.role === 'assistant') {
            const contentText = msg.content.trim()
            if (!contentText) {
              return false
            }

            if (contentText.startsWith('请求失败:')) {
              return false
            }

            return true
          }

          return false
        })
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

      // 构建请求payload - 所有配置参数从view_custom_agent_path接口获取
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

      // 创建AbortController用于取消请求
      const controller = new AbortController()
      
      // 调用流式API
      let accumulatedReasoning = ''
      await chatCustomAgentStream(config, payload, controller.signal, {
        onReasoningDelta: (text: string) => {
          accumulatedReasoning += text
          setChatMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg
              return {
                ...msg,
                thinking: [
                  {
                    id: 'think-reasoning',
                    label: accumulatedReasoning,
                    icon: <BulbOutlined />,
                    status: 'running',
                  },
                ],
              }
            }),
          )
        },
        onTextDelta: (text: string) => {
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + text }
                : msg,
            ),
          )
        },
        onThinking: (thinking) => {
          setChatMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg
              
              const existingThinking = msg.thinking || []
              const existingIndex = existingThinking.findIndex((t) => t.label === thinking.label)
              
              let newThinking: typeof existingThinking
              if (existingIndex >= 0) {
                newThinking = existingThinking.map((t, i) =>
                  i === existingIndex ? { ...t, ...thinking } : t,
                )
              } else {
                newThinking = [...existingThinking, {
                  id: `think-${Date.now()}`,
                  label: thinking.label,
                  icon: <BulbOutlined />,
                  status: thinking.status,
                  results: thinking.results,
                }]
              }
              
              return { ...msg, thinking: newThinking }
            }),
          )
        },
        onToolCall: (toolCall) => {
          setChatMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg
              
              const existingToolCalls = msg.toolCalls || []
              const existingIndex = existingToolCalls.findIndex((t) => t.name === toolCall.name)
              
              let newToolCalls: ToolCall[]
              if (existingIndex >= 0) {
                newToolCalls = existingToolCalls.map((t, i) =>
                  i === existingIndex ? { ...t, ...toolCall, input: toolCall.input as Record<string, unknown> | undefined } : t,
                )
              } else {
                newToolCalls = [...existingToolCalls, {
                  id: `tool-${Date.now()}`,
                  name: toolCall.name,
                  status: toolCall.status,
                  input: toolCall.input as Record<string, unknown> | undefined,
                  output: toolCall.output,
                }]
              }
              
              return { ...msg, toolCalls: newToolCalls }
            }),
          )
        },
        onComplete: () => {
          setChatMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg
              // 将思考过程标记为完成
              const updatedThinking = msg.thinking?.map((t) =>
                t.id === 'think-reasoning' ? { ...t, status: 'complete' as const } : t,
              )
              return { ...msg, loading: false, thinking: updatedThinking }
            }),
          )
          setIsChatResponding(false)
        },
        onError: (error) => {
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: msg.content || `请求失败: ${error.message}`,
                    loading: false,
                  }
                : msg,
            ),
          )
          setIsChatResponding(false)
        },
      })
    } catch (error) {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: msg.content || `请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
                loading: false,
              }
            : msg,
        ),
      )
      setIsChatResponding(false)
    }
  }, [chatInputValue, isChatResponding, chatMessages, agentName, agentInstruction, agentSubtitle, agentSkills, resourceIds, webSearchEnabled])

  // 处理推荐问题点击
  const handleSuggestionClick = useCallback((question: string) => {
    setChatInputValue(question)
  }, [])

  // 切换思考展开状态
  const toggleThinking = useCallback((messageId: string) => {
    setShowThinking((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }, [])

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

              {/* 消息列表 */}
              {chatMessages.length > 0 && (
                <div className={styles.messageList}>
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant}`}>
                      {msg.role === 'user' ? (
                        <div className={styles.userMessageBubble}>
                          {msg.content}
                        </div>
                      ) : (
                        <div className={styles.assistantMessageWrap}>
                          {/* 思考过程 */}
                          {msg.thinking && msg.thinking.length > 0 && (
                            <div className={styles.thinkingPanel}>
                              <button
                                type="button"
                                className={styles.thinkingToggle}
                                onClick={() => toggleThinking(msg.id)}
                              >
                                <BulbOutlined />
                                <span>{showThinking[msg.id] ? '隐藏思考' : '展开思考'}</span>
                                <CaretUpOutlined className={showThinking[msg.id] ? '' : styles.thinkingToggle} />
                              </button>
                              {showThinking[msg.id] && (
                                <div className={styles.thinkingContent}>
                                  {msg.thinking.map((step) => (
                                    <div key={step.id} className={styles.thinkingStep}>
                                      <span className={styles.thinkingStepIcon}>{step.icon}</span>
                                      <span className={styles.thinkingStepLabel}>{step.label}</span>
                                      <span className={`${styles.thinkingStepStatus} ${step.status === 'running' ? styles.thinkingStepStatusRunning : ''}`}>
                                        {step.status === 'running' ? <LoadingOutlined spin /> : '完成'}
                                      </span>
                                    </div>
                                  ))}
                                  {/* 工具调用结果 */}
                                  {msg.toolCalls && msg.toolCalls.some((tc) => tc.output) && (
                                    <div className={styles.toolResultChips}>
                                      {msg.toolCalls
                                        .filter((tc) => tc.output)
                                        .map((tc) => {
                                          const output = tc.output as { results?: string[] } | undefined
                                          return output?.results?.map((result, idx) => (
                                            <span key={`${tc.id}-${idx}`} className={styles.toolResultChip}>
                                              {result}
                                            </span>
                                          ))
                                        })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 加载动画 */}
                          {msg.loading && !msg.content && (
                            <div className={styles.loadingDots}>
                              <span className={styles.loadingDot} />
                              <span className={styles.loadingDot} />
                              <span className={styles.loadingDot} />
                            </div>
                          )}
                          
                          {/* 回复内容 */}
                          {msg.content && (
                            <div className={styles.assistantMessageBubble}>
                              {msg.content}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
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
    </div>
  )
}
