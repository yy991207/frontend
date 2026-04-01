import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  CopyOutlined,
  EllipsisOutlined,
  ExportOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  StarOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import styles from './partner.module.less'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  loading?: boolean
}

const MOCK_REPLY = '您好！我是飞书AI助手，很高兴为您服务。有什么我可以帮助您的吗？'

const ATTACHMENT_ACTIONS = [
  { key: 'upload', label: '上传文件或图片', icon: <PaperClipOutlined /> },
  { key: 'doc', label: '添加飞书云文档', icon: <FileAddOutlined /> },
  { key: 'skill', label: '技能', icon: <ThunderboltOutlined />, hasArrow: true },
  { key: 'tool', label: '工具', icon: <ToolOutlined />, hasArrow: true },
]

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function PartnerPage() {
  const location = useLocation()
  const timerRef = useRef<number | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const [toolInfoOpen, setToolInfoOpen] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false)
  const [draft, setDraft] = useState('')

  const initialPrompt = useMemo(() => {
    const value = location.state as { initialPrompt?: string } | null
    return value?.initialPrompt?.trim() ?? ''
  }, [location.state])

  const initialConversation = useMemo(() => {
    if (!initialPrompt) {
      return null
    }

    const now = new Date()
    return {
      userMessage: {
        id: `user-${now.getTime()}`,
        role: 'user' as const,
        content: initialPrompt,
        timestamp: formatTime(now),
      },
      loadingMessage: {
        id: `assistant-${now.getTime()}`,
        role: 'assistant' as const,
        content: '',
        timestamp: formatTime(now),
        loading: true,
      },
    }
  }, [initialPrompt])

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialConversation ? [initialConversation.userMessage, initialConversation.loadingMessage] : [],
  )
  const [isResponding, setIsResponding] = useState(() => Boolean(initialConversation))

  const startAssistantReply = (prompt: string) => {
    const now = new Date()
    const userMessage: ChatMessage = {
      id: `user-${now.getTime()}`,
      role: 'user',
      content: prompt,
      timestamp: formatTime(now),
    }
    const loadingMessage: ChatMessage = {
      id: `assistant-${now.getTime()}`,
      role: 'assistant',
      content: '',
      timestamp: formatTime(now),
      loading: true,
    }

    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setIsResponding(true)

    timerRef.current = window.setTimeout(() => {
      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        prev.map((item) =>
          item.id === loadingMessage.id
            ? {
                ...item,
                content: MOCK_REPLY,
                timestamp: replyTime,
                loading: false,
              }
            : item,
        ),
      )
      setIsResponding(false)
      timerRef.current = null
    }, 1600)
  }

  useEffect(() => {
    if (!initialConversation) {
      return
    }

    timerRef.current = window.setTimeout(() => {
      const replyTime = formatTime(new Date())
      setMessages((prev) =>
        prev.map((item) =>
          item.id === initialConversation.loadingMessage.id
            ? {
                ...item,
                content: MOCK_REPLY,
                timestamp: replyTime,
                loading: false,
              }
            : item,
        ),
      )
      setIsResponding(false)
      timerRef.current = null
    }, 1600)

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [initialConversation])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setAttachMenuOpen(false)
        setToolMenuOpen(false)
        setToolInfoOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const handleSend = () => {
    const value = draft.trim()
    if (!value || isResponding) return

    setDraft('')
    setAttachMenuOpen(false)
    setToolMenuOpen(false)
    setToolInfoOpen(false)
    startAssistantReply(value)
  }

  const handleStop = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setMessages((prev) => prev.filter((item) => !item.loading))
    setIsResponding(false)
  }

  const handleCopy = async (content: string) => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      // 复制失败时不额外打断页面交互。
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h1 className={styles.title}>Lily</h1>
          <div className={styles.headerActions}>
            <button type="button" className={styles.headerButton} aria-label="分享">
              <ExportOutlined />
            </button>
            <button type="button" className={styles.headerButton} aria-label="文件夹">
              <FolderOpenOutlined />
            </button>
            <button type="button" className={styles.headerButton} aria-label="更多">
              <EllipsisOutlined />
            </button>
          </div>
        </header>

        <div className={styles.messages}>
          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className={styles.userRow}>
                <div className={styles.userMessageWrap}>
                  <div className={styles.userBubble}>{message.content}</div>
                  <div className={styles.userActions}>
                    <span>{message.timestamp}</span>
                    <button type="button" className={styles.inlineAction} onClick={() => handleCopy(message.content)}>
                      <CopyOutlined />
                      <span>复制</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={message.id} className={styles.assistantRow}>
                {message.loading ? (
                  <div className={styles.loadingDots}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </div>
                ) : (
                  <div className={styles.assistantMessageWrap}>
                    <div className={styles.assistantText}>{message.content}</div>
                    <div className={styles.assistantFooter}>
                      <button type="button" className={styles.inlineAction} onClick={() => handleCopy(message.content)}>
                        <CopyOutlined />
                        <span>复制</span>
                      </button>
                    </div>
                    <div className={styles.assistantHoverBar}>
                      <span>结果评分</span>
                      <div className={styles.starRow}>
                        {Array.from({ length: 5 }).map((_, index) => (
                          <button key={index} type="button" className={styles.starButton} aria-label={`评分 ${index + 1}`}>
                            <StarOutlined />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ),
          )}
        </div>

        <div className={styles.composerArea}>
          <div ref={composerRef} className={styles.composerWrap}>
            <div className={styles.composer}>
              <div className={styles.attachTriggerWrap}>
                <button
                  type="button"
                  className={`${styles.circleButton} ${styles.attachButton} ${attachMenuOpen ? styles.attachButtonActive : ''}`}
                  aria-label={attachMenuOpen ? '关闭上传菜单' : '打开上传菜单'}
                  aria-expanded={attachMenuOpen}
                  onClick={() => setAttachMenuOpen((value) => !value)}
                >
                  {attachMenuOpen ? <CloseOutlined /> : <PlusOutlined />}
                </button>
                {!attachMenuOpen ? <div className={styles.attachTooltip}>上传附件/技能等</div> : null}
              </div>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSend()
                  }
                }}
                className={styles.composerInput}
                placeholder="下一步要做什么？"
              />
              <button type="button" className={styles.iconButton} aria-label="语音输入">
                <AudioOutlined />
              </button>
              {isResponding ? (
                <button type="button" className={`${styles.circleButton} ${styles.stopButton}`} onClick={handleStop}>
                  <span className={styles.stopInner} />
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.circleButton} ${styles.sendButton} ${!draft.trim() ? styles.sendButtonDisabled : ''}`}
                  onClick={handleSend}
                  disabled={!draft.trim()}
                >
                  <ArrowUpOutlined />
                </button>
              )}
            </div>
            <div
              className={`${styles.attachMenuLayer} ${attachMenuOpen ? styles.attachMenuLayerOpen : ''}`}
              onMouseLeave={() => {
                setToolMenuOpen(false)
                setToolInfoOpen(false)
              }}
            >
              <div className={styles.attachMenu} role="menu">
                {ATTACHMENT_ACTIONS.map((action) =>
                  action.key === 'tool' ? (
                    <button
                      key={action.key}
                      type="button"
                      className={`${styles.attachMenuItem} ${toolMenuOpen ? styles.attachMenuItemActive : ''}`}
                      onMouseEnter={() => setToolMenuOpen(true)}
                    >
                      <span className={styles.attachMenuMain}>
                        <span className={styles.attachMenuIcon}>{action.icon}</span>
                        <span>{action.label}</span>
                      </span>
                      <RightOutlined className={styles.attachMenuArrow} />
                    </button>
                  ) : (
                    <button key={action.key} type="button" className={styles.attachMenuItem} onMouseEnter={() => setToolMenuOpen(false)}>
                      <span className={styles.attachMenuMain}>
                        <span className={styles.attachMenuIcon}>{action.icon}</span>
                        <span>{action.label}</span>
                      </span>
                      {action.hasArrow ? <RightOutlined className={styles.attachMenuArrow} /> : null}
                    </button>
                  ),
                )}
              </div>

              <div className={`${styles.toolSubmenu} ${toolMenuOpen ? styles.toolSubmenuOpen : ''}`}>
                <div className={styles.toolSubmenuHeader}>
                  <span>工具</span>
                  <button
                    type="button"
                    className={styles.toolInfoButton}
                    aria-label="工具说明"
                    onClick={() => setToolInfoOpen((value) => !value)}
                  >
                    <InfoCircleOutlined />
                  </button>
                  {toolInfoOpen ? (
                    <div className={styles.toolInfoPopover}>
                      默认内置飞书相关工具：知识问答、消息、妙记、云文档、多维表格、日程、任务
                    </div>
                  ) : null}
                </div>

                <div className={styles.toolItem}>
                  <span className={styles.toolItemMain}>
                    <GlobalOutlined />
                    <span>互联网检索</span>
                  </span>
                  <button
                    type="button"
                    className={`${styles.switchButton} ${webSearchEnabled ? styles.switchButtonOn : ''}`}
                    onClick={() => setWebSearchEnabled((value) => !value)}
                  >
                    <span className={styles.switchThumb} />
                  </button>
                </div>

                <div className={styles.toolItem}>
                  <span className={styles.toolItemMain}>
                    <LinkOutlined />
                    <span>自定义知识</span>
                  </span>
                  <button
                    type="button"
                    className={`${styles.switchButton} ${knowledgeEnabled ? styles.switchButtonOn : ''}`}
                    onClick={() => setKnowledgeEnabled((value) => !value)}
                  >
                    <span className={styles.switchThumb} />
                  </button>
                </div>

                <button type="button" className={`${styles.toolItem} ${styles.toolManageButton}`}>
                  <span className={styles.attachMenuMain}>
                    <span className={styles.toolItemMain}>
                      <SettingOutlined />
                      <span>工具管理</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div className={styles.footerHint}>AI 生成内容可能有误，请核实重要信息</div>
        </div>
      </section>
    </main>
  )
}
