import { useParams, useNavigate } from 'react-router-dom'
import { Dropdown, Input } from 'antd'
import { SettingOutlined, ArrowUpOutlined, AudioOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback, useRef } from 'react'
import { viewCustomAgent, loadCustomAgentApiConfig, type AgentDetail } from '../../services/customAgentService'
import { createChatSession, type ChatApiConfig, parseChatApiConfig } from '../../services/chatService'
import styles from './agentConversation.module.less'

export default function AgentConversationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [agentData, setAgentData] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const messagesViewportRef = useRef<HTMLDivElement>(null)

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
        // 加载 agent 详情
        const config = await loadCustomAgentApiConfig()
        const agent = await viewCustomAgent(config, id)

        if (!cancelled) {
          setAgentData(agent)
        }

        // 创建会话
        setSessionLoading(true)
        const chatConfig = await loadChatApiConfig()
        const session = await createChatSession(chatConfig)
        
        if (!cancelled) {
          setSessionId(session.sessionId)
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

    loadAgentAndCreateSession()

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
    // TODO: 触发聊天发送
    console.log('点击推荐问题:', question)
    setDraft(question)
  }, [])

  const handleSend = useCallback(() => {
    if (!draft.trim()) return
    // TODO: 实现发送逻辑
    console.log('发送消息:', draft)
    setDraft('')
  }, [draft])

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
        {/* 头部区域 */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.avatar}>
              {agentData?.agent_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className={styles.headerInfo}>
              <h1 className={styles.agentName}>{agentData?.agent_name || '智能体'}</h1>
              {agentData?.description && (
                <p className={styles.agentDesc}>{agentData.description}</p>
              )}
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

        {/* 消息区域 */}
        <div ref={messagesViewportRef} className={styles.messages}>
          <div className={styles.messageColumn}>
            {/* 空状态欢迎区域 */}
            <div className={styles.welcomeArea}>
              <div className={styles.welcomeIcon}>
                {agentData?.agent_name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <h2 className={styles.welcomeTitle}>
                你好，我是 {agentData?.agent_name || '智能体'}
              </h2>
              {agentData?.description && (
                <p className={styles.welcomeDesc}>{agentData.description}</p>
              )}
              
              {/* 推荐问题 */}
              {agentData?.preset_questions && agentData.preset_questions.length > 0 && (
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
              )}
            </div>
          </div>
        </div>

        {/* 输入区域 */}
        <div className={styles.composerArea}>
          <div className={styles.composerWrap}>
            <div className={styles.inputWrap}>
              {/* 上方输入区域 */}
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
                    // 支持 Enter 发送，Shift+Enter 换行
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
              {/* 下方按钮区域 */}
              <div className={styles.inputBottomArea}>
                <div className={styles.inputBottomLeft}>
                  {/* 可扩展：附件菜单等 */}
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
                      disabled={!draft.trim()}
                    >
                      <ArrowUpOutlined />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.footerHint}>
            {sessionLoading ? '正在创建会话...' : error || 'AI 生成内容可能有误，请核实重要信息'}
          </div>
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