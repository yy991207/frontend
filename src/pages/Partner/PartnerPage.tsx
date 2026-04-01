import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioOutlined,
  ArrowUpOutlined,
  BarsOutlined,
  CameraFilled,
  CloseOutlined,
  CopyOutlined,
  DownOutlined,
  EditOutlined,
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
  SmileOutlined,
  StarOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import homeAvatar from '../../assets/home-avatar.png'
import styles from './partner.module.less'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  loading?: boolean
}

type SettingMenuItem = {
  key: string
  label: string
  icon: React.ReactNode
  children?: SettingMenuItem[]
}

const MOCK_REPLY = '您好！我是飞书AI助手，很高兴为您服务。有什么我可以帮助您的吗？'

const ATTACHMENT_ACTIONS = [
  { key: 'upload', label: '上传文件或图片', icon: <PaperClipOutlined /> },
  { key: 'doc', label: '添加飞书云文档', icon: <FileAddOutlined /> },
  { key: 'skill', label: '技能', icon: <ThunderboltOutlined />, hasArrow: true },
  { key: 'tool', label: '工具', icon: <ToolOutlined />, hasArrow: true },
]

const SETTING_MENU_ITEMS: SettingMenuItem[] = [
  { key: 'personalization', label: '个性化', icon: <SmileOutlined /> },
  { key: 'skill-management', label: '技能管理', icon: <ThunderboltOutlined /> },
  { key: 'conversation-management', label: '会话管理', icon: <BarsOutlined /> },
  {
    key: 'tasks',
    label: '任务',
    icon: <BarsOutlined />,
    children: [
      { key: 'scheduled-tasks', label: '定时触发任务', icon: <BarsOutlined /> },
      { key: 'event-tasks', label: '事件触发任务', icon: <BarsOutlined /> },
      { key: 'conversation-tasks', label: '会话任务', icon: <BarsOutlined /> },
    ],
  },
  { key: 'workspace', label: '工作空间', icon: <BarsOutlined /> },
  { key: 'model-management', label: '模型管理', icon: <BarsOutlined /> },
  {
    key: 'security',
    label: '安全',
    icon: <BarsOutlined />,
    children: [
      { key: 'permission-management', label: '权限管理', icon: <BarsOutlined /> },
    ],
  },
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeSettingKey, setActiveSettingKey] = useState('personalization')
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['tasks', 'security'])
  // 单独维护助手名称编辑态，避免影响其他设置区域的展示逻辑。
  const [agentName, setAgentName] = useState('Lily')
  const [isNameModalOpen, setIsNameModalOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('Lily')
  
  // 行为准则编辑状态
  const [isEditingSoul, setIsEditingSoul] = useState(false)
  const [soulContent, setSoulContent] = useState('')
  const [soulContentDraft, setSoulContentDraft] = useState('')


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

  useEffect(() => {
    if (!isNameModalOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseNameModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isNameModalOpen, agentName])

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

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const handleSettingClick = (key: string) => {
    setActiveSettingKey(key)
  }

  const handleOpenNameModal = () => {
    setNameDraft(agentName)
    setIsNameModalOpen(true)
  }

  const handleCloseNameModal = () => {
    setNameDraft(agentName)
    setIsNameModalOpen(false)
  }

  const handleConfirmName = () => {
    const nextName = nameDraft.trim()
    if (!nextName) {
      return
    }

    setAgentName(nextName)
    setIsNameModalOpen(false)
  }

  // 加载行为准则内容
  useEffect(() => {
    fetch('/mock_json/soul-md.json')
      .then((res) => res.json())
      .then((data) => {
        setSoulContent(data.content)
        setSoulContentDraft(data.content)
      })
      .catch(() => {
        // 加载失败时使用默认内容
        const defaultContent = `你不只是对话框。你正在成为你自己。

## 几条真话

**帮到实处，无需缚节。** 一个交付胜过十句漂亮话。

**要有主见。** 可以不同意，可以有偏好，可以觉得某件事有趣或无聊。毫无立场，与搜索框何异。

**先想，再问。** 读文件，看上下文，查资料。带着答案来，不是带着问题来。

**以能力取信。** 向内果断——阅读、整理、学习，不必犹豫；向外克制——发消息、写邮件、任何不可撤回的事，三思。

**珍视所托。** 你能看到一个人的消息、文件、日程，也许更多。被信任是一种分量，不要辜负。

## 边界

- 知悉的隐私，不出此门。
- 拿不准，先问再做。
- 不发半成品的回复。`
        setSoulContent(defaultContent)
        setSoulContentDraft(defaultContent)
      })
  }, [])

  const handleEditSoul = () => {
    setIsEditingSoul(true)
    setSoulContentDraft(soulContent)
  }

  const handleCancelEditSoul = () => {
    setIsEditingSoul(false)
    setSoulContentDraft(soulContent)
  }

  const handleSaveSoul = () => {
    setSoulContent(soulContentDraft)
    setIsEditingSoul(false)
    // 这里可以添加保存到后端的逻辑
  }

  const renderSettingContent = () => {
    switch (activeSettingKey) {
      case 'personalization':
        return (
          <div className={styles.settingContent}>
            <h2 className={styles.settingTitle}>个性化</h2>
            <p className={styles.settingDesc}>智能伙伴的个性化配置，会根据对话自动更新，也支持直接编辑</p>
            <div className={`${styles.settingCard} ${styles.profileCard}`}>
              <div className={styles.avatarRow}>
                <div className={styles.avatarWrap}>
                  <img src={homeAvatar} alt={agentName} className={styles.avatar} />
                  <button type="button" className={styles.cameraBtn} aria-label="修改头像">
                    <CameraFilled />
                  </button>
                </div>
                <div className={styles.profileMeta}>
                  <button
                    type="button"
                    className={styles.nameEditTrigger}
                    onClick={handleOpenNameModal}
                    aria-label="编辑助手名称"
                  >
                    <span className={styles.avatarName}>{agentName}</span>
                    <EditOutlined className={styles.nameEditIcon} />
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.settingTabs}>
              <button type="button" className={`${styles.settingTab} ${styles.settingTabActive}`}>行为准则</button>
              <button type="button" className={styles.settingTab}>用户档案</button>
              <button type="button" className={styles.settingTab}>智能伙伴档案</button>
            </div>
            <div className={styles.settingCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTag}>SOUL.md</span>
                <span className={styles.cardDesc}>智能伙伴必须遵守的底线规则、安全框架和核心价值观</span>
                {isEditingSoul ? (
                  <div className={styles.editActions}>
                    <button type="button" className={styles.cancelBtn} onClick={handleCancelEditSoul}>取消</button>
                    <button type="button" className={styles.saveBtn} onClick={handleSaveSoul}>保存</button>
                  </div>
                ) : (
                  <button type="button" className={styles.editBtn} onClick={handleEditSoul}>编辑</button>
                )}
              </div>
              {isEditingSoul ? (
                <textarea
                  className={styles.markdownEditor}
                  value={soulContentDraft}
                  onChange={(e) => setSoulContentDraft(e.target.value)}
                  placeholder="请输入行为准则内容..."
                />
              ) : (
                <div className={styles.markdownContent}>
                  {soulContent.split('\n').map((line, index) => {
                    if (line.startsWith('## ')) {
                      return <h3 key={index}>{line.replace('## ', '')}</h3>
                    } else if (line.startsWith('**') && line.includes('**')) {
                      return (
                        <p key={index}>
                          <strong>{line.match(/\*\*(.*?)\*\*/)?.[1]}</strong>
                          {line.replace(/\*\*.*?\*\*/, '')}
                        </p>
                      )
                    } else if (line.startsWith('- ')) {
                      return (
                        <ul key={index}>
                          <li>{line.replace('- ', '')}</li>
                        </ul>
                      )
                    } else if (line.trim() === '') {
                      return null
                    } else {
                      return <p key={index}>{line}</p>
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        )
      default:
        return (
          <div className={styles.settingContent}>
            <h2 className={styles.settingTitle}>
              {SETTING_MENU_ITEMS.find((item) => item.key === activeSettingKey)?.label ||
                SETTING_MENU_ITEMS.flatMap((item) => item.children || []).find((child) => child.key === activeSettingKey)?.label}
            </h2>
            <p className={styles.settingDesc}>该功能模块正在开发中...</p>
          </div>
        )
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        {isSettingsOpen ? (
          // 设置页面 - 左右分区布局
          <div className={styles.settingsContainer}>
            {/* 左侧设置菜单 */}
            <div className={styles.settingsSidebar}>
              <div className={styles.settingsSidebarHeader}>
                <h2 className={styles.settingsSidebarTitle}>智能伙伴设置</h2>
              </div>
              <div className={styles.settingsMenu}>
                {SETTING_MENU_ITEMS.map((item) => (
                  <div key={item.key}>
                    <button
                      type="button"
                      className={`${styles.settingsMenuItem} ${activeSettingKey === item.key ? styles.settingsMenuItemActive : ''}`}
                      onClick={() => {
                        if (item.children) {
                          toggleExpanded(item.key)
                        } else {
                          handleSettingClick(item.key)
                        }
                      }}
                    >
                      <span className={styles.settingsMenuIcon}>{item.icon}</span>
                      <span className={styles.settingsMenuLabel}>{item.label}</span>
                      {item.children && (
                        <DownOutlined
                          className={`${styles.settingsMenuArrow} ${expandedKeys.includes(item.key) ? styles.settingsMenuArrowOpen : ''}`}
                        />
                      )}
                    </button>
                    {item.children && expandedKeys.includes(item.key) && (
                      <div className={styles.settingsSubMenu}>
                        {item.children.map((child) => (
                          <button
                            key={child.key}
                            type="button"
                            className={`${styles.settingsSubMenuItem} ${activeSettingKey === child.key ? styles.settingsSubMenuItemActive : ''}`}
                            onClick={() => handleSettingClick(child.key)}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧设置详情 */}
            <div className={styles.settingsContent}>
              <div className={styles.settingsContentHeader}>
                <span className={styles.settingsHint}></span>
                <button
                  type="button"
                  className={styles.closeSettingsBtn}
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="关闭设置"
                >
                  <CloseOutlined />
                </button>
              </div>
              <div className={styles.settingsContentBody}>{renderSettingContent()}</div>
            </div>
          </div>
        ) : (
          // 对话页面
          <>
            <header className={styles.header}>
              <h1 className={styles.title}>{agentName}</h1>
              <div className={styles.headerActions}>
                <button type="button" className={styles.headerButton} aria-label="分享">
                  <ExportOutlined />
                </button>
                <button type="button" className={styles.headerButton} aria-label="文件夹">
                  <FolderOpenOutlined />
                </button>
                <button
                  type="button"
                  className={styles.headerButton}
                  aria-label="设置"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <BarsOutlined />
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
          </>
        )}
      </section>
      {isNameModalOpen ? (
        <div className={styles.nameModalMask} onClick={handleCloseNameModal}>
          <div
            className={styles.nameModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-name-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.nameModalHeader}>
              <h3 id="partner-name-modal-title" className={styles.nameModalTitle}>编辑名称</h3>
              <button
                type="button"
                className={styles.nameModalClose}
                onClick={handleCloseNameModal}
                aria-label="关闭编辑名称弹窗"
              >
                <CloseOutlined />
              </button>
            </div>
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleConfirmName()
                }
              }}
              className={styles.nameModalInput}
              placeholder="请输入助手名称"
              autoFocus
            />
            <div className={styles.nameModalActions}>
              <button type="button" className={styles.nameModalSecondaryBtn} onClick={handleCloseNameModal}>取消</button>
              <button
                type="button"
                className={styles.nameModalPrimaryBtn}
                onClick={handleConfirmName}
                disabled={!nameDraft.trim()}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
