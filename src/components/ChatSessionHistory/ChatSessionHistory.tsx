import { useEffect, useState, useCallback } from 'react'
import { HistoryOutlined } from '@ant-design/icons'
import type { ChatSession, ChatSessionConfig } from '../../services/chatSessionService'
import {
  fetchChatSessions,
  groupSessionsByTime,
  getSessionDisplayName,
  getDefaultConfig,
} from '../../services/chatSessionService'
import styles from './chatSessionHistory.module.less'

// 加载配置
async function loadConfig(): Promise<ChatSessionConfig> {
  try {
    const response = await fetch('/config.yaml')
    if (response.ok) {
      const rawText = await response.text()
      const { parseChatSessionConfig } = await import('../../services/chatSessionService')
      return parseChatSessionConfig(rawText)
    }
  } catch {
    // 如果加载失败，使用默认配置
  }
  return getDefaultConfig()
}

interface ChatSessionHistoryProps {
  expanded: boolean
}

export default function ChatSessionHistory({ expanded }: ChatSessionHistoryProps) {
  const [sessions, setSessions] = useState<{
    today: ChatSession[]
    within7Days: ChatSession[]
    beyond7Days: ChatSession[]
  }>({ today: [], within7Days: [], beyond7Days: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const config = await loadConfig()
      const allSessions = await fetchChatSessions(config)
      const grouped = groupSessionsByTime(allSessions)
      setSessions(grouped)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载会话列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (expanded) {
      loadSessions()
    }
  }, [expanded, loadSessions])

  const handleSessionClick = (sessionId: string) => {
    console.log('点击会话:', sessionId)
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const renderSessionItem = (session: ChatSession) => (
    <div
      key={session.session_id}
      className={styles.sessionItem}
      onClick={() => handleSessionClick(session.session_id)}
      title={getSessionDisplayName(session)}
    >
      <span className={styles.sessionName}>{getSessionDisplayName(session)}</span>
    </div>
  )

  const renderSection = (title: string, items: ChatSession[], showDivider: boolean = false) => {
    if (items.length === 0) {
      return null
    }

    return (
      <div className={styles.section}>
        {showDivider && <div className={styles.sectionDivider} />}
        <div className={styles.sectionHeader}>{title}</div>
        <div className={styles.sectionContent}>
          {items.map(renderSessionItem)}
        </div>
      </div>
    )
  }

  const hasAnySessions =
    sessions.today.length > 0 ||
    sessions.within7Days.length > 0 ||
    sessions.beyond7Days.length > 0

  // 收起状态：显示图标按钮
  if (!expanded) {
    return (
      <button
        type="button"
        className={`${styles.collapsedButton} ${styles.tooltipTarget}`}
        data-tooltip="会话历史"
        onClick={handleToggle}
      >
        <span className={styles.iconCell}>
          <HistoryOutlined />
        </span>
      </button>
    )
  }

  // 展开状态：显示完整面板
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <HistoryOutlined className={styles.headerIcon} />
        <span className={styles.headerTitle}>会话历史</span>
      </div>

      <div className={styles.content}>
        {loading && <div className={styles.loading}>加载中...</div>}

        {!loading && error && (
          <div className={styles.error}>
            <div>{error}</div>
            <button onClick={loadSessions} className={styles.retryButton}>
              重试
            </button>
          </div>
        )}

        {!loading && !error && !hasAnySessions && (
          <div className={styles.empty}>暂无会话记录</div>
        )}

        {!loading && !error && hasAnySessions && (
          <>
            {renderSection('今天', sessions.today)}
            {renderSection('7天内', sessions.within7Days, sessions.today.length > 0)}
            {renderSection('7天外', sessions.beyond7Days, sessions.today.length > 0 || sessions.within7Days.length > 0)}
          </>
        )}
      </div>
    </div>
  )
}
