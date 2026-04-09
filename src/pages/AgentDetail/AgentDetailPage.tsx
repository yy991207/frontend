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
import { message, Spin } from 'antd'
import EditAgentModal from '../../components/common/EditAgentModal'
import {
  loadCustomAgentApiConfig,
  createCustomAgent,
  viewCustomAgent,
  type AgentDetail,
} from '../../services/customAgentService'
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
  const [agentSkills, setAgentSkills] = useState<string[]>([])
  const [agentQuestions, setAgentQuestions] = useState<{ category: string; question: string }[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [resourceIds, setResourceIds] = useState<string[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [hasChanges, setHasChanges] = useState(false)

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

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} tip="加载中..." />
        </div>
      </div>
    )
  }

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
        avatar_url: agentData.avatar_url,
        description: agentSubtitle,
        enabled_skills: agentSkills,
        is_public: isPublic,
        preset_questions: agentQuestions,
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

  const avatarUrl = agentData.avatar_url.startsWith('http')
    ? agentData.avatar_url
    : `http://192.168.30.238:8000${agentData.avatar_url}`

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.backIcon}>⌂</span>
          <span className={styles.topTitle}>{agentName}</span>
          <EditOutlined className={styles.topEditIcon} onClick={handleEditClick} />
        </div>

        <div className={styles.topTabs}>
          <button type="button" className={`${styles.topTab} ${styles.topTabActive}`}>
            搭建
          </button>
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
                  {agentQuestions.map((item) => (
                    <button key={item.question} type="button" className={styles.suggestionChip}>
                      {item.question}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.chatComposerWrap}>
              <div className={styles.chatComposer}>
                <input
                  className={styles.chatInput}
                  value="问我任何问题"
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
                {agentSkills.map((skillName) => (
                  <div key={skillName} className={styles.serviceCard}>
                    <div className={styles.serviceIconWrap}>
                      <SafetyCertificateOutlined />
                    </div>
                    <div className={styles.serviceContent}>
                      <div className={styles.serviceTopLine}>
                        <span className={styles.serviceName}>{skillName}</span>
                        <span className={styles.serviceBadge}>官方</span>
                        <span className={styles.serviceArrow}>›</span>
                      </div>
                      <p className={styles.serviceDesc}>支持{skillName}相关功能</p>
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
                {agentQuestions.map((item, index: number) => (
                  <div key={item.question} className={styles.questionRow}>
                    <span className={styles.questionText}>{item.question}</span>
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
        avatar={avatarUrl}
        onCancel={handleModalCancel}
        onSave={handleModalSave}
      />
    </div>
  )
}
