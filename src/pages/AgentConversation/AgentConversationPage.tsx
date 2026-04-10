import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { Dropdown, Input } from 'antd'
import { SettingOutlined, ArrowUpOutlined, AudioOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback } from 'react'
import { MessageList } from '../../components/chat/message-list'
import { viewCustomAgent, loadCustomAgentApiConfig, type AgentDetail } from '../../services/customAgentService'
import { parseChatApiConfig, type ChatApiConfig } from '../../services/chatService'
import { useSharedChatRuntime } from '../../services/sharedChatRuntime'
import styles from './agentConversation.module.less'

export default function AgentConversationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [agentData, setAgentData] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [chatApiConfig, setChatApiConfig] = useState<ChatApiConfig | null>(null)

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
    getToolDisplayTitle,
    getToolDisplaySummary,
  } = useSharedChatRuntime({
    chatApiConfig,
    sessionId,
    routeSessionId: new URLSearchParams(location.search).get('sessionId'),
    setSessionId,
    enableWebSearch: true,
  })

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
          setSessionLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载智能体或创建会话失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setSessionLoading(false)
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
            {groupedMessages.length > 0 ? (
              <MessageList
                groups={groupedMessages}
                threadLoading={sessionLoading}
                copiedMessageId={copiedMessageId}
                assistantCopyTargets={assistantCopyTargets}
                onCopy={handleCopy}
                getToolDisplayTitle={getToolDisplayTitle}
                getToolDisplaySummary={getToolDisplaySummary}
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
                          onClick={() => handleSuggestionClick(item.question)}
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
              <div className={styles.inputTopArea}>
                <Input.TextArea
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                  }}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
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
                  placeholder="输入你的问题..."
                  autoSize={{ minRows: 1, maxRows: 8 }}
                />
              </div>
              <div className={styles.inputBottomArea}>
                <div className={styles.inputBottomLeft} />
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
    </main>
  )
}

async function loadChatApiConfig(): Promise<ChatApiConfig> {
  const response = await fetch('/config.yaml')
  if (!response.ok) {
    throw new Error('加载配置文件失败')
  }
  const rawText = await response.text()
  return parseChatApiConfig(rawText)
}
