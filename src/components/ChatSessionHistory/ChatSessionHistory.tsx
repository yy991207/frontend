import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { HistoryOutlined, MoreOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ChatSession, ChatSessionConfig } from '../../services/chatSessionService'
import {
  fetchChatSessions,
  groupSessionsByTime,
  getSessionDisplayName,
  getDefaultConfig,
  deleteChatSession,
} from '../../services/chatSessionService'
import { CHAT_SESSION_HISTORY_REFRESH_EVENT } from '../../services/chatSessionEvents'
import { DeleteConfirmModal } from '../common/DeleteConfirmModal'
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
  onExpand?: () => void
}

// 会话菜单组件
interface SessionMenuProps {
  session: ChatSession
  onDelete: (session: ChatSession) => void
}

function SessionMenu({ session, onDelete }: SessionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const willOpen = !isOpen

    if (willOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }

    setIsOpen(willOpen)
  }

  const handleDelete = () => {
    onDelete(session)
    setIsOpen(false)
  }

  const dropdownContent = isOpen && dropdownPosition ? (
    <div
      ref={dropdownRef}
      className={styles.menuDropdown}
      style={{
        position: 'fixed',
        top: `${dropdownPosition.top}px`,
        right: `${dropdownPosition.right}px`,
      }}
    >
      <button type="button" className={styles.menuItem} onClick={handleDelete}>
        <DeleteOutlined className={styles.menuItemIcon} />
        <span className={styles.menuItemText}>删除</span>
      </button>
    </div>
  ) : null

  return (
    <div className={styles.menuContainer} ref={menuRef}>
      <button
        type="button"
        className={styles.moreButton}
        ref={buttonRef}
        onClick={handleToggle}
      >
        <MoreOutlined />
      </button>

      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  )
}

export default function ChatSessionHistory({ expanded, onExpand }: ChatSessionHistoryProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sessions, setSessions] = useState<{
    today: ChatSession[]
    within7Days: ChatSession[]
    beyond7Days: ChatSession[]
  }>({ today: [], within7Days: [], beyond7Days: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTargetSession, setDeleteTargetSession] = useState<ChatSession | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 获取当前会话 ID
  const getCurrentSessionId = useCallback(() => {
    const params = new URLSearchParams(location.search)
    return params.get('sessionId')
  }, [location.search])

  const loadSessions = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false

    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      const config = await loadConfig()
      const allSessions = await fetchChatSessions(config)
      const grouped = groupSessionsByTime(allSessions)
      setSessions(grouped)
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : '加载会话列表失败')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (expanded) {
      loadSessions()
    }
  }, [expanded, loadSessions, location.pathname, location.search])

  useEffect(() => {
    const handleRefresh = () => {
      if (!expanded) {
        return
      }

      void loadSessions({ silent: true })
    }

    window.addEventListener(CHAT_SESSION_HISTORY_REFRESH_EVENT, handleRefresh)

    return () => {
      window.removeEventListener(CHAT_SESSION_HISTORY_REFRESH_EVENT, handleRefresh)
    }
  }, [expanded, loadSessions])

  const handleSessionClick = (sessionId: string) => {
    navigate(`/chat?sessionId=${sessionId}`)
  }

  const handleToggle = () => {
    onExpand?.()
  }

  const handleDeleteSession = async (session: ChatSession) => {
    try {
      setDeleteLoading(true)
      const config = await loadConfig()
      await deleteChatSession(config, session.session_id)
      // 删除成功后重新加载列表
      await loadSessions()
      setDeleteTargetSession(null)
      // 如果删除的是当前正在查看的会话，跳转到首页
      const currentSessionId = getCurrentSessionId()
      if (currentSessionId === session.session_id) {
        navigate('/')
      }
    } catch (err) {
      console.error('删除会话失败:', err)
      alert(err instanceof Error ? err.message : '删除会话失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  const renderSessionItem = (session: ChatSession) => (
    <div
      key={session.session_id}
      className={styles.sessionItem}
      onClick={() => handleSessionClick(session.session_id)}
      title={getSessionDisplayName(session)}
    >
      <MessageOutlined className={styles.sessionIcon} />
      <span className={styles.sessionName}>{getSessionDisplayName(session)}</span>
      <SessionMenu session={session} onDelete={setDeleteTargetSession} />
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
    <>
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
              <button onClick={() => void loadSessions()} className={styles.retryButton}>
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

      <DeleteConfirmModal
        open={Boolean(deleteTargetSession)}
        title="删除会话"
        description="确认删除后将无法恢复，是否继续？"
        loading={deleteLoading}
        onCancel={() => setDeleteTargetSession(null)}
        onConfirm={() => {
          if (deleteTargetSession) {
            void handleDeleteSession(deleteTargetSession)
          }
        }}
      />
    </>
  )
}
