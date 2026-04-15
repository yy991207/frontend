import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { AppPageShell, AppSurfacePanel } from '../../components/layout/AppPageShell'
import { SettingOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ArtifactFileDetail } from '../../components/chat/artifact-file-detail'
import { ArtifactsProvider, useArtifacts } from '../../components/chat/artifacts-context'
import { MessageList } from '../../components/chat/message-list'
import { useAutoScroll } from '../../components/chat/use-auto-scroll'
import { ThreadLoading } from '../../components/chat/ChatLoadingAnimation'
import { viewCustomAgent, loadCustomAgentApiConfig, type AgentDetail, type EnabledSkill } from '../../services/customAgentService'
import { parseChatApiConfig, type ChatApiConfig } from '../../services/chatService'
import { useSharedChatRuntime } from '../../services/sharedChatRuntime'
import type { AttachmentSkillItem } from '../../components/common/AttachmentMenu'
import { ChatComposer } from '../../components/common/ChatComposer'
import {
  createPendingUploadedFile,
  type UploadedFile,
  isAllowedFileType,
  ALLOWED_FILE_EXTENSIONS,
} from '../../services/ossUploadService'
import { uploadPendingFileToOssWithDocumentParse } from '../../services/agentFileUploadService'
import {
  buildSkillInitialPrompt,
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
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [slashCommandOpen, setSlashCommandOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const skipSlashSelectRef = useRef(false)

  const filteredSkills = useMemo(() => {
    if (!slashQuery) {
      return skills
    }

    const query = slashQuery.toLowerCase()
    return skills.filter((skill) =>
      skill.title.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query) ||
      skill.skillName.toLowerCase().includes(query),
    )
  }, [skills, slashQuery])

  const clearSelectedSkill = () => {
    setSelectedSkillName('')
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

  const handleManageSkills = () => {
    navigate('/skills', {
      state: {
        mode: 'manage',
      },
    })
  }

  const handleSelectSkill = (skill: SkillItemType) => {
    setSelectedSkillName(skill.skillName || skill.id)
    skipSlashSelectRef.current = true
    setDraft(buildSkillInitialPrompt(skill))
    requestAnimationFrame(() => { skipSlashSelectRef.current = false })
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
    uploadedFiles,
    onFilesSent: () => setUploadedFiles([]),
  })

  const routeSessionId = new URLSearchParams(location.search).get('sessionId')
  const shouldShowHistoryLoading = routeSessionId && sessionLoading && groupedMessages.length === 0

  const { containerRef: messagesViewportRef } = useAutoScroll({
    messages: groupedMessages,
    isResponding,
    sessionLoading,
  })

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
      <AppPageShell className={styles.page}>
        <AppSurfacePanel className={styles.panel}>
          <div className={styles.loadingState}>
            <span>加载中...</span>
          </div>
        </AppSurfacePanel>
      </AppPageShell>
    )
  }

  if (error) {
    return (
      <AppPageShell className={styles.page}>
        <AppSurfacePanel className={styles.panel}>
          <div className={styles.errorState}>
            <span>{error}</span>
          </div>
        </AppSurfacePanel>
      </AppPageShell>
    )
  }

  return (
    <AppPageShell className={styles.page}>
      <div className={`${styles.splitContainer} ${artifactOpen ? styles.splitContainerOpen : ''}`}>
        <AppSurfacePanel className={styles.panel}>
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
              <button
                type="button"
                className={styles.headerButton}
                onClick={handleNavigateToConfig}
                aria-label="编辑智能体"
                data-tooltip="编辑智能体"
              >
                <SettingOutlined />
              </button>
            </div>
          </header>

          <div ref={messagesViewportRef} className={styles.messages}>
            <div className={styles.messageColumn}>
              {shouldShowHistoryLoading ? (
                <ThreadLoading />
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
              <ChatComposer
                variant="agentConversation"
                value={draft}
                onChange={(value) => {
                  setDraft(value)

                  if (skipSlashSelectRef.current) return
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
                          prev < filteredSkills.length - 1 ? prev + 1 : prev,
                        )
                        return
                      case 'ArrowUp':
                        event.preventDefault()
                        setSelectedSkillIndex((prev) => (prev > 0 ? prev - 1 : 0))
                        return
                      case 'Enter':
                        event.preventDefault()
                        if (filteredSkills[selectedSkillIndex]) {
                          event.stopPropagation()
                          handleSelectSkill(filteredSkills[selectedSkillIndex])
                          setSlashCommandOpen(false)
                          setSlashQuery('')
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
                onSend={handleSend}
                placeholder='输入你的想法或输入"/"选择想要使用技能'
                slashCommandOpen={slashCommandOpen}
                slashQuery={slashQuery}
                onSlashQueryChange={setSlashQuery}
                skills={skills}
                filteredSkills={filteredSkills}
                skillsLoading={false}
                loadSkills={async () => {}}
                selectedSkillIndex={selectedSkillIndex}
                onSelectSkill={(skill) => {
                  handleSelectSkill(skill)
                  setSlashCommandOpen(false)
                  setSlashQuery('')
                }}
                onCloseSlashCommand={() => setSlashCommandOpen(false)}
                onManageSkills={handleManageSkills}
                uploadedFiles={uploadedFiles}
                onRemoveFile={handleRemoveFile}
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
                onUploadFile={handleUploadFile}
                webSearchEnabled={webSearchEnabled}
                webSearchLocked={webSearchLocked}
                knowledgeEnabled={false}
                onToggleWebSearch={() => setWebSearchEnabled((value) => !value)}
                onLockedWebSearchClick={() => {
                  void message.info('当前智能体未开启联网检索，暂不可配置')
                }}
                onToggleKnowledge={() => {}}
                sendDisabled={!draft.trim() || uploadedFiles.some((f) => f.status === 'uploading' || f.status === 'parsing')}
                isResponding={isResponding}
              />
            </div>
            <div className={styles.footerHint}>{requestError || 'AI 生成内容可能有误，请核实重要信息'}</div>
          </div>
        </AppSurfacePanel>
        <AppSurfacePanel className={`${styles.artifactPanel} ${artifactOpen ? styles.artifactPanelOpen : styles.artifactPanelClosed}`}>
          <AgentConversationArtifactPanel />
        </AppSurfacePanel>
      </div>
    </AppPageShell>
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
