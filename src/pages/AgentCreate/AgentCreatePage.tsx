import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppstoreAddOutlined,
  ArrowUpOutlined,
  CameraOutlined,
  EditOutlined,
  GlobalOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SoundOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { message } from 'antd'
import EditAgentModal from '../../components/common/EditAgentModal'
import SkillConfigModal from '../../components/common/SkillConfigModal'
import KnowledgeSpaceModal from '../../components/common/KnowledgeSpaceModal'
import SkillDetailPanel from '../../components/common/SkillDetailPanel'
import {
  loadCustomAgentApiConfig,
  createCustomAgent,
  type EnabledSkill,
} from '../../services/customAgentService'
import styles from '../AgentDetail/agentDetail.module.less'

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
  const navigate = useNavigate()
  const [agentName, setAgentName] = useState('未命名智能体')
  const [agentSubtitle, setAgentSubtitle] = useState('')
  const [agentInstruction, setAgentInstruction] = useState('')
  const [agentSkills, setAgentSkills] = useState<EnabledSkill[]>([])
  const [hoveredSkillName, setHoveredSkillName] = useState<string | null>(null)
  const [agentQuestions, setAgentQuestions] = useState<{ category: string; question: string }[]>([])
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

  const handlePublish = async () => {
    if (!agentName.trim()) {
      message.error('智能体名称不能为空')
      return
    }

    if (!agentInstruction.trim()) {
      message.error('指令不能为空')
      return
    }

    const emptyQuestions = agentQuestions.filter((q) => !q.question || !q.category)
    if (emptyQuestions.length > 0) {
      const emptyIndexes = agentQuestions
        .map((q, i) => (!q.question || !q.category) ? i + 1 : null)
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
              '发布中...'
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
            </div>

            <div className={styles.messagesArea}>
              <div className={styles.heroSection}>
                <div className={styles.heroCard}>
                  <div className={styles.heroAvatar}>
                    <span className={styles.avatarLetter}>{getAvatarLetter(agentName)}</span>
                  </div>
                  <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>{agentName}</h1>
                    <p className={styles.heroSubtitle}>{agentSubtitle || '请在右侧配置智能体信息'}</p>
                  </div>
                </div>

                <div className={styles.suggestionSection}>
                  <h3 className={styles.suggestionTitle}>提示</h3>
                  <div className={styles.suggestionList}>
                    <div style={{ 
                      color: '#666', 
                      fontSize: '14px', 
                      padding: '12px', 
                      background: '#f5f5f5', 
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      创建智能体后可在此测试对话效果
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.composerArea}>
              <div className={styles.composerWrap}>
                <div className={styles.inputWrap}>
                  <div className={styles.inputTopArea}>
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 14,
                      color: '#999',
                      padding: '8px 12px',
                      background: 'transparent',
                    }}>
                      请先完成智能体配置并创建后再测试对话
                    </div>
                  </div>
                  <div className={styles.inputBottomArea}>
                    <div className={styles.inputBottomLeft}>
                      <button type="button" className={styles.toolPill} disabled style={{ opacity: 0.5 }}>
                        <SoundOutlined />
                        深度规划
                      </button>
                      <button type="button" className={`${styles.toolPill} ${webSearchEnabled ? styles.toolPillActive : ''}`} disabled style={{ opacity: 0.5 }}>
                        <GlobalOutlined />
                        联网
                      </button>
                      <button type="button" className={styles.toolPill} disabled style={{ opacity: 0.5 }}>
                        <AppstoreAddOutlined />
                        工具
                        <span className={styles.toolCaret}>⌄</span>
                      </button>
                    </div>
                    <div className={styles.inputBottomRight}>
                      <div className={styles.inputActions}>
                        <button type="button" className={styles.iconBtn} disabled style={{ opacity: 0.5 }} aria-label="附件">
                          <PaperClipOutlined />
                        </button>
                        <button type="button" className={styles.iconBtn} disabled style={{ opacity: 0.5 }} aria-label="语音">
                          <SoundOutlined />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.sendBtn} ${styles.sendBtnDisabled}`}
                          disabled
                        >
                          <ArrowUpOutlined />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.footerHint}>AI 生成内容可能有误，请核实重要信息</div>
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