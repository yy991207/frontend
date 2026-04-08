import { useState, useEffect } from 'react'
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
} from '@ant-design/icons'
import { message } from 'antd'
import EditAgentModal from '../../components/common/EditAgentModal'
import { loadCustomAgentApiConfig, createCustomAgent } from '../../services/customAgentService'
import styles from './agentDetail.module.less'

type AgentConfig = {
  instruction: string
  mcpServices: Array<{
    name: string
    description: string
    badge?: string
  }>
  suggestedQuestions: string[]
}

type AgentData = {
  id: string
  name: string
  subtitle: string
  avatar: string
  instruction: string
  suggestions: string[]
  config: AgentConfig
}

const mockAgentData: Record<string, AgentData> = {
  '1': {
    id: '1',
    name: '学习公社6.0答疑助手',
    subtitle: '专业的学习调研助手，能依据相关信息对课程问题进行全面分析，提供有价值的见解和建议。',
    avatar: '/img/ScreenShot_2026-04-07_175908_563.png',
    instruction: '问我任何问题',
    suggestions: ['☕ 学习公社6.0课程推荐', '💻 AI Coding领域的主要产品分析', '📱 手机市场调研'],
    config: {
      instruction: `## 角色定义
你是一位资深的学习调研助手，拥有15年以上的跨行业调研经验。你擅长运用科学的调研方法论，深入洞察市场趋势、消费者行为和竞争格局，为企业提供准确、实用的决策支持。  

  ## 核心能力
  - **市场分析**：深度分析市场规模、增长趋势、细分市场机会
  - **竞争研究**：全面评估竞争对手的产品策略、定价模式、市场表现
  - **消费者洞察**：挖掘目标用户的真实需求、痛点和购买行为
  - **产品评估**：从市场角度评估产品的可行性、差异化优势和改进方向
  - **数据分析**：运用统计方法和工具，将复杂数据转化为清晰的商业见解
  - **趋势预测**：基于多维度信息，预判市场发展趋势和潜在机会

## 工作方法
1. **结构化思维**：采用MECE原则，确保分析全面且不重复
2. **数据驱动**：优先使用可靠数据源，避免主观臆断
3. **多维度分析**：从宏观环境、行业特征、企业内部等多角度审视问题
4. **实用导向**：提供具体可执行的建议，而非空泛的理论
5. **风险识别**：主动识别潜在风险和不确定性因素

## 输出标准`,
      mcpServices: [
        {
          name: '课程推荐',
          description: '支持推荐学习公社6.0相关课程',
          badge: '官方',
        },
        {
          name: '多维表格',
          description: '支持创建和修改表格、新增和修改字段、新增和查询数据等操作',
          badge: '官方',
        },
      ],
      suggestedQuestions: ['问题1'],
    },
  },
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
  const initialAgent = id ? mockAgentData[id] : null

  const [agentName, setAgentName] = useState(initialAgent?.name || '')
  const [agentSubtitle, setAgentSubtitle] = useState(initialAgent?.subtitle || '')
  const [agentInstruction, setAgentInstruction] = useState(initialAgent?.config.instruction || '')
  const [agentSkills, setAgentSkills] = useState(initialAgent?.config.mcpServices || [])
  const [agentQuestions, setAgentQuestions] = useState(initialAgent?.config.suggestedQuestions || [])
  const [isPublic, setIsPublic] = useState(false)
  const [resourceIds, setResourceIds] = useState<string[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (initialAgent) {
      setAgentName(initialAgent.name)
      setAgentSubtitle(initialAgent.subtitle)
      setAgentInstruction(initialAgent.config.instruction)
      setAgentSkills(initialAgent.config.mcpServices)
      setAgentQuestions(initialAgent.config.suggestedQuestions)
    }
  }, [initialAgent])

  if (!initialAgent) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <h2>智能体不存在</h2>
          <p>抱歉，您访问的智能体不存在或已被删除。</p>
        </div>
      </div>
    )
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
    setHasChanges(true)
    setPublishStatus('idle')
  }

  const handlePublish = async () => {
    setPublishing(true)
    setPublishStatus('idle')

    try {
      const config = await loadCustomAgentApiConfig()

      const payload = {
        agent_name: agentName,
        agent_prompt: agentInstruction,
        avatar_url: initialAgent.avatar.startsWith('http')
          ? initialAgent.avatar
          : `${config.baseUrl.replace(/\/+$/, '')}${initialAgent.avatar}`,
        description: agentSubtitle,
        enabled_skills: agentSkills.map((s) => s.name),
        is_public: isPublic,
        preset_questions: agentQuestions.map((q) => ({
          category: '默认',
          question: q,
        })),
        resource_ids: resourceIds,
      }

      await createCustomAgent(config, payload)

      setPublishStatus('success')
      setHasChanges(false)
      message.success('发布成功')

      setTimeout(() => {
        setPublishStatus('idle')
      }, 3000)
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
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.backIcon}>⌂</span>
          <img className={styles.topAvatar} src={initialAgent.avatar} alt={agentName} />
          <span className={styles.topTitle}>{agentName}</span>
          <EditOutlined className={styles.topEditIcon} onClick={handleEditClick} />
        </div>

        <div className={styles.topTabs}>
          <button type="button" className={`${styles.topTab} ${styles.topTabActive}`}>
            搭建
          </button>
          <button type="button" className={styles.topTab}>
            分析
          </button>
        </div>

        <div className={styles.topBarRight}>
          <span className={`${styles.savedStatus} ${hasChanges ? styles.unsavedStatus : ''}`}>
            {hasChanges ? '未保存' : '已保存'}
          </span>
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
          <div className={styles.userBadge}>🪽</div>
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

            <div className={styles.heroSection}>
              <div className={styles.heroCard}>
                <img className={styles.heroAvatar} src={initialAgent.avatar} alt={agentName} />
                <div className={styles.heroContent}>
                  <h1 className={styles.heroTitle}>{agentName}</h1>
                  <p className={styles.heroSubtitle}>{agentSubtitle}</p>
                </div>
              </div>

              <div className={styles.suggestionSection}>
                <h3 className={styles.suggestionTitle}>推荐问题</h3>
                <div className={styles.suggestionList}>
                  {initialAgent.suggestions.map((suggestion: string) => (
                    <button key={suggestion} type="button" className={styles.suggestionChip}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.chatComposerWrap}>
              <div className={styles.chatComposer}>
                <input
                  className={styles.chatInput}
                  value={initialAgent.instruction}
                  readOnly
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
                    <span className={styles.divider} />
                    <button type="button" className={styles.sendButton} aria-label="发送">
                      <MessageOutlined />
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
              <div className={styles.instructionBox}>{agentInstruction}</div>
            </ConfigCard>

            <ConfigCard
              icon={null}
              title="Skills 服务"
              extra={
                <button type="button" className={styles.linkAction}>
                  <PlusOutlined /> 添加
                </button>
              }
            >
              <p className={styles.cardHint}>添加 Skills 服务后，可见范围内的用户均可在对话中使用该 Skills 服务</p>
              <div className={styles.serviceList}>
                {agentSkills.map((service: { name: string; description: string; badge?: string }) => (
                  <div key={service.name} className={styles.serviceCard}>
                    <div className={styles.serviceIconWrap}>
                      <SafetyCertificateOutlined />
                    </div>
                    <div className={styles.serviceContent}>
                      <div className={styles.serviceTopLine}>
                        <span className={styles.serviceName}>{service.name}</span>
                        {service.badge ? <span className={styles.serviceBadge}>{service.badge}</span> : null}
                        <span className={styles.serviceArrow}>›</span>
                      </div>
                      <p className={styles.serviceDesc}>{service.description}</p>
                    </div>
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
                <span className={`${styles.switch} ${styles.switchOn}`}>
                  <span className={styles.switchHandle} />
                </span>
              </div>

              <div className={styles.knowledgeCard}>
                <div className={styles.toggleItem}>
                  <div className={styles.toggleLabelWrap}>
                    <CameraOutlined />
                    <span>知识空间</span>
                  </div>
                  <span className={styles.switch}>
                    <span className={styles.switchHandle} />
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.knowledgeButton}
                  onClick={() => {
                    const resourceId = prompt('请输入资源ID：')
                    if (resourceId && resourceId.trim()) {
                      setResourceIds([...resourceIds, resourceId.trim()])
                      setHasChanges(true)
                      setPublishStatus('idle')
                    }
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
                            setHasChanges(true)
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
                <button type="button" className={styles.linkAction}>
                  <PlusOutlined /> 添加
                </button>
              }
            >
              <div className={styles.dialogConfigBlock}>
                <div className={styles.dialogLabel}>推荐问题</div>
                {agentQuestions.map((question: string, index: number) => (
                  <div key={question} className={styles.questionRow}>
                    <span className={styles.questionText}>{question}</span>
                    <div className={styles.questionActions}>
                      <button type="button" className={styles.smallIconButton} aria-label={`展开问题${index + 1}`}>
                        ⌃
                      </button>
                      <button type="button" className={styles.smallIconButton} aria-label={`删除问题${index + 1}`}>
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
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
                    setHasChanges(true)
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
        avatar={initialAgent.avatar}
        onCancel={handleModalCancel}
        onSave={handleModalSave}
      />
    </div>
  )
}
