import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { Dropdown, Input } from 'antd'
import { SettingOutlined, ArrowUpOutlined, AudioOutlined, CloseOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArtifactFileDetail } from '../../components/chat/artifact-file-detail'
import { ArtifactsProvider, useArtifacts } from '../../components/chat/artifacts-context'
import { MessageList } from '../../components/chat/message-list'
import { viewCustomAgent, loadCustomAgentApiConfig, type AgentDetail, type EnabledSkill } from '../../services/customAgentService'
import { parseChatApiConfig, type ChatApiConfig } from '../../services/chatService'
import { useSharedChatRuntime } from '../../services/sharedChatRuntime'
import { AttachmentMenu, type AttachmentSkillItem } from '../../components/common/AttachmentMenu'
import { SkillSlashCommand } from '../../components/common/SkillSlashCommand'
import {
  buildSkillDisplayName,
} from '../../services/skillPromptService'
import styles from './agentConversation.module.less'

type SkillItemType = AttachmentSkillItem

export default function AgentConversationPage() {
  return (
    <ArtifactsProvider>
      <AgentConversationPageContent />
    </ArtifactsProvider>
  )
}

function AgentConversationPageContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { addFile, selectFile, open: artifactOpen } = useArtifacts()
  const [agentData, setAgentData] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chatApiConfig, setChatApiConfig] = useState<ChatApiConfig | null>(null)
  const [skills, setSkills] = useState<SkillItemType[]>([])
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [webSearchLocked, setWebSearchLocked] = useState(false)
  const [preferredToolType, setPreferredToolType] = useState<string | null>(null)
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [selectedSkillDescription, setSelectedSkillDescription] = useState('')
  const [slashCommandOpen, setSlashCommandOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)

  const clearSelectedSkill = () => {
    setPreferredToolType(null)
    setSelectedSkillName('')
    setSelectedSkillDescription('')
  }

  const handleManageSkills = () => {
    navigate('/skills', {
      state: {
        mode: 'manage',
      },
    })
  }

  const handleSelectSkill = (skill: SkillItemType) => {
    setSelectedSkillName(skill.skillName || skill.id)
    setSelectedSkillDescription(skill.description)
    setPreferredToolType(skill.skillName || skill.id)
    setDraft(skill.template)
  }

  const {
    draft,
    setDraft,
    groupedMessages,
    assistantCopyTargets,
    copiedMessageId,
    handleCopy,
    handleSend,
    isResponding,
    requestError,
    sessionLoading,
    getToolDisplayTitle,
    getToolDisplaySummary,
  } = useSharedChatRuntime({
    chatApiConfig,
    sessionId,
    routeSessionId: new URLSearchParams(location.search).get('sessionId'),
    setSessionId,
    enableWebSearch: webSearchEnabled,
    agentId: id,
  })

  const routeSessionId = new URLSearchParams(location.search).get('sessionId')
  const shouldShowHistoryLoading = routeSessionId && sessionLoading && groupedMessages.length === 0

  const sessionBaseUrl = useMemo(() => {
    if (!chatApiConfig) return null
    try {
      const url = new URL(chatApiConfig.streamEndpointBase)
      return `${url.protocol}//${url.host}`
    } catch {
      return null
    }
  }, [chatApiConfig])

  const currentSessionId = useMemo(() => {
    const routeSessionId = new URLSearchParams(location.search).get('sessionId')
    return routeSessionId || sessionId || null
  }, [location.search, sessionId])

  const syncSessionToRoute = useCallback((newSessionId: string) => {
    navigate(
      {
        pathname: location.pathname,
        search: `?sessionId=${newSessionId}`,
      },
      { replace: true, state: null },
    )
  }, [location.pathname, navigate])

  useEffect(() => {
    if (sessionId && !new URLSearchParams(location.search).get('sessionId')) {
      syncSessionToRoute(sessionId)
    }
  }, [sessionId, location.search, syncSessionToRoute])

  const handleOpenFile = useCallback((filepath: string, originalUrl?: string) => {
    if (!currentSessionId || !sessionBaseUrl) return
    const artifactFile = { filepath, sessionId: currentSessionId, baseUrl: sessionBaseUrl, originalUrl }
    addFile(artifactFile)
    selectFile(artifactFile)
  }, [currentSessionId, sessionBaseUrl, addFile, selectFile])

  useEffect(() => {
    let cancelled = false

    async function loadAgentAndCreateSession() {
      if (!id) {
        setError('智能体ID不能为空')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setAgentData(null)
      setSessionId(null)

      try {
        const config = await loadCustomAgentApiConfig()
        const agent = await viewCustomAgent(config, id)
        const nextChatApiConfig = await loadChatApiConfig()

        if (!cancelled) {
          setAgentData(agent)
          setChatApiConfig(nextChatApiConfig)
          setWebSearchEnabled(agent.enable_web_search)
          setWebSearchLocked(!agent.enable_web_search)

          const agentSkills: SkillItemType[] = (agent.enabled_skills || []).map((skill: EnabledSkill) => ({
            id: skill.skill_name,
            skillName: skill.skill_name,
            title: skill.chinese_name || skill.skill_name,
            description: skill.description || '',
            template: skill.template || '',
            isSelected: false,
          }))
          setSkills(agentSkills)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载智能体或创建会话失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAgentAndCreateSession()

    return () => {
      cancelled = true
    }
  }, [id])

  const handleNavigateToConfig = useCallback(() => {
    if (id) {
      navigate(`/agent/${id}`)
    }
  }, [id, navigate])

  const handleSuggestionClick = useCallback((question: string) => {
    setDraft(question)
  }, [setDraft])

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.panel}>
          <div className={styles.loadingState}>
            <span>加载中...</span>
          </div>
        </section>
      </main>
    )
  }

  if (error) {
    return (
      <main className={styles.page}>
        <section className={styles.panel}>
          <div className={styles.errorState}>
            <span>{error}</span>
          </div>
        </section>
      </main>
    )
  }

  const dropdownMenu = {
    items: [
      {
        key: 'config',
        label: '配置',
        icon: <SettingOutlined />,
        onClick: handleNavigateToConfig,
      },
    ],
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.splitContainer} ${artifactOpen ? styles.splitContainerOpen : ''}`}>
        <section className={styles.panel}>
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.avatar}>
                {agentData?.agent_name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className={styles.headerInfo}>
                <h1 className={styles.agentName}>{agentData?.agent_name || '智能体'}</h1>
                {agentData?.description ? <p className={styles.agentDesc}>{agentData.description}</p> : null}
              </div>
            </div>
            <div className={styles.headerRight}>
              <Dropdown menu={dropdownMenu} trigger={['click']}>
                <button type="button" className={styles.headerButton}>
                  <SettingOutlined />
                </button>
              </Dropdown>
            </div>
          </header>

          <div className={styles.messages}>
            <div className={styles.messageColumn}>
              {shouldShowHistoryLoading ? (
                <div className={styles.loadingState}>
                  <span>加载历史消息...</span>
                </div>
              ) : groupedMessages.length > 0 ? (
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
              ) : (
                <div className={styles.welcomeArea}>
                  <div className={styles.welcomeIcon}>
                    {agentData?.agent_name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <h2 className={styles.welcomeTitle}>你好，我是 {agentData?.agent_name || '智能体'}</h2>
                  {agentData?.description ? <p className={styles.welcomeDesc}>{agentData.description}</p> : null}
                  {agentData?.preset_questions && agentData.preset_questions.length > 0 ? (
                    <div className={styles.suggestionsSection}>
                      <h3 className={styles.suggestionsTitle}>你可以问我</h3>
                      <div className={styles.suggestionsList}>
                        {agentData.preset_questions.slice(0, 4).map((item, index) => (
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
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className={styles.composerArea}>
            <div className={styles.composerWrap}>
              <div className={styles.inputWrap}>
                <SkillSlashCommand
                  visible={slashCommandOpen}
                  query={slashQuery}
                  setQuery={(query) => {
                    setSlashQuery(query)
                    setDraft('/' + query)
                  }}
                  skills={skills.filter((skill) => {
                    if (!slashQuery) return true
                    const q = slashQuery.toLowerCase()
                    return (
                      skill.title.toLowerCase().includes(q) ||
                      skill.description.toLowerCase().includes(q) ||
                      skill.skillName.toLowerCase().includes(q)
                    )
                  })}
                  loading={false}
                  selectedIndex={selectedSkillIndex}
                  onSelectSkill={(skill) => {
                    handleSelectSkill(skill)
                    setSlashCommandOpen(false)
                    setDraft('')
                  }}
                  onClose={() => setSlashCommandOpen(false)}
                  onManageSkills={handleManageSkills}
                />
                <div className={styles.inputTopArea}>
                  {selectedSkillName ? <span className={styles.skillPrefix}>基于</span> : null}
                  {selectedSkillName ? (
                    <span className={styles.skillTagWrap}>
                      <span className={styles.skillNameTag}>{buildSkillDisplayName(selectedSkillName)}</span>
                      <button
                        type="button"
                        className={styles.skillRemoveButton}
                        aria-label="移除已选技能"
                        onClick={clearSelectedSkill}
                      >
                        <CloseOutlined />
                      </button>
                      {selectedSkillDescription ? (
                        <span className={styles.skillDescriptionTooltip}>{selectedSkillDescription}</span>
                      ) : null}
                    </span>
                  ) : null}
                  <Input.TextArea
                    value={draft}
                    onChange={(event) => {
                      const value = event.target.value
                      setDraft(value)
                      
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

                      if (slashCommandOpen) {
                        switch (event.key) {
                          case 'ArrowDown':
                            event.preventDefault()
                            setSelectedSkillIndex((prev) =>
                              prev < skills.length - 1 ? prev + 1 : prev
                            )
                            return
                          case 'ArrowUp':
                            event.preventDefault()
                            setSelectedSkillIndex((prev) => (prev > 0 ? prev - 1 : 0))
                            return
                          case 'Enter':
                            event.preventDefault()
                            const filteredSkills = skills.filter((skill) => {
                              if (!slashQuery) return true
                              const q = slashQuery.toLowerCase()
                              return (
                                skill.title.toLowerCase().includes(q) ||
                                skill.description.toLowerCase().includes(q) ||
                                skill.skillName.toLowerCase().includes(q)
                              )
                            })
                            if (filteredSkills[selectedSkillIndex]) {
                              handleSelectSkill(filteredSkills[selectedSkillIndex])
                              setSlashCommandOpen(false)
                              setDraft('')
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

                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        handleSend()
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      boxShadow: 'none',
                      background: 'transparent',
                      fontSize: 14,
                      resize: 'none',
                      minHeight: 24,
                      maxHeight: 200,
                      overflowY: 'auto',
                      lineHeight: 1.5,
                      padding: 0,
                    }}
                    variant="borderless"
                    placeholder='输入你的问题或输入"/"选择想要使用技能'
                    autoSize={{ minRows: 1, maxRows: 8 }}
                  />
                </div>
                <div className={styles.inputBottomArea}>
                  <div className={styles.inputBottomLeft}>
                    <AttachmentMenu
                      placement="top"
                      skills={skills}
                      skillsLoading={false}
                      loadSkills={() => Promise.resolve()}
                      onSelectSkill={handleSelectSkill}
                      onManageSkills={handleManageSkills}
                      showTools
                      webSearchEnabled={webSearchEnabled}
                      knowledgeEnabled={false}
                      onToggleWebSearch={() => {
                        if (!webSearchLocked) {
                          setWebSearchEnabled((value) => !value)
                        }
                      }}
                      onToggleKnowledge={() => {}}
                    />
                  </div>
                  <div className={styles.inputBottomRight}>
                    <span className={styles.tabHint}>Tab</span>
                    <div className={styles.inputActions}>
                      <button type="button" className={styles.iconBtn} aria-label="语音输入">
                        <AudioOutlined />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.sendBtn} ${!draft.trim() ? styles.sendBtnDisabled : ''}`}
                        onClick={handleSend}
                        disabled={!draft.trim() || isResponding}
                      >
                        <ArrowUpOutlined />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.footerHint}>{requestError || 'AI 生成内容可能有误，请核实重要信息'}</div>
          </div>
        </section>
        <section className={`${styles.artifactPanel} ${artifactOpen ? styles.artifactPanelOpen : styles.artifactPanelClosed}`}>
          <AgentConversationArtifactPanel />
        </section>
      </div>
    </main>
  )
}

function AgentConversationArtifactPanel() {
  const { selectedFile, open } = useArtifacts()

  if (!selectedFile || !open) return null

  return <ArtifactFileDetail file={selectedFile} />
}

async function loadChatApiConfig(): Promise<ChatApiConfig> {
  const response = await fetch('/config.yaml')
  if (!response.ok) {
    throw new Error('加载配置文件失败')
  }
  const rawText = await response.text()
  return parseChatApiConfig(rawText)
}
