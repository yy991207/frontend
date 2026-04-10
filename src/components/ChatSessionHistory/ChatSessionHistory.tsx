import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
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

export default function ChatSessionHistory({ expanded }: ChatSessionHistoryProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sessions, setSessions] = useState<{
    today: ChatSession[]
    within7Days: ChatSession[]
    beyond7Days: ChatSession[]
  }>({ today: [], within7Days: [], beyond7Days: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [deleteTargetSession, setDeleteTargetSession] = useState<ChatSession | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [removingSessionIds, setRemovingSessionIds] = useState<Set<string>>(new Set())
  const hasPrefetchedRef = useRef(false)

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
      setHasLoadedOnce(true)
      setError(null)
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
    if (hasPrefetchedRef.current) {
      return
    }

    hasPrefetchedRef.current = true
    // 组件挂载后先静默预取一轮，避免用户首次展开侧边栏时先看到整块 loading 闪一下。
    void loadSessions({ silent: true })
  }, [loadSessions])

  useEffect(() => {
    if (!expanded) {
      return
    }

    if (!hasLoadedOnce) {
      return
    }

    void loadSessions({ silent: true })
  }, [expanded, hasLoadedOnce, loadSessions, location.pathname, location.search])

  useEffect(() => {
    const handleRefresh = () => {
      if (!expanded || !hasLoadedOnce) {
        return
      }

      void loadSessions({ silent: true })
    }

    window.addEventListener(CHAT_SESSION_HISTORY_REFRESH_EVENT, handleRefresh)

    return () => {
      window.removeEventListener(CHAT_SESSION_HISTORY_REFRESH_EVENT, handleRefresh)
    }
  }, [expanded, hasLoadedOnce, loadSessions])

  const handleSessionClick = (sessionId: string) => {
    navigate(`/chat?sessionId=${sessionId}`)
  }

  const handleDeleteSession = async (session: ChatSession) => {
    try {
      setDeleteLoading(true)
      setRemovingSessionIds((prev) => new Set(prev).add(session.session_id))

      await new Promise((resolve) => setTimeout(resolve, 200))

      const config = await loadConfig()
      await deleteChatSession(config, session.session_id)

      setRemovingSessionIds((prev) => {
        const next = new Set(prev)
        next.delete(session.session_id)
        return next
      })

      await loadSessions({ silent: true })
      setDeleteTargetSession(null)

      const currentSessionId = getCurrentSessionId()
      if (currentSessionId === session.session_id) {
        navigate('/')
      }
    } catch (err) {
      setRemovingSessionIds((prev) => {
        const next = new Set(prev)
        next.delete(session.session_id)
        return next
      })
      console.error('删除会话失败:', err)
      alert(err instanceof Error ? err.message : '删除会话失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  const renderSessionItem = (session: ChatSession) => {
    const isRemoving = removingSessionIds.has(session.session_id)
    return (
      <div
        key={session.session_id}
        className={`${styles.sessionItem} ${isRemoving ? styles.sessionItemRemoving : ''}`}
        onClick={() => handleSessionClick(session.session_id)}
        title={getSessionDisplayName(session)}
      >
        <MessageOutlined className={styles.sessionIcon} />
        <span className={styles.sessionName}>{getSessionDisplayName(session)}</span>
        <SessionMenu session={session} onDelete={setDeleteTargetSession} />
      </div>
    )
  }

  const renderSection = (title: string, items: ChatSession[], showDivider: boolean = false) => {
    if (items.length === 0) {
      return null
    }

    return (
      <div className={`${styles.section} ${expanded ? '' : styles.sectionCollapsed}`}>
        {expanded && showDivider && <div className={styles.sectionDivider} />}
        {expanded && <div className={styles.sectionHeader}>{title}</div>}
        <div className={styles.sectionContent}>
          {items.map((item) => renderSessionItem(item))}
        </div>
      </div>
    )
  }

  const hasAnySessions =
    sessions.today.length > 0 ||
    sessions.within7Days.length > 0 ||
    sessions.beyond7Days.length > 0
  const shouldShowBlockingState = !hasLoadedOnce && loading && !hasAnySessions
  const shouldShowEmptyState = hasLoadedOnce && !error && !hasAnySessions
  const shouldShowList = hasAnySessions
  const contentClassName = useMemo(
    () => `${styles.content} ${expanded ? styles.contentExpanded : styles.contentCollapsed}`,
    [expanded],
  )
  const listClassName = useMemo(
    () => `${styles.sessionList} ${expanded ? styles.sessionListExpanded : styles.sessionListCollapsed}`,
    [expanded],
  )

  return (
    <>
      <div className={styles.container}>
        {expanded && <div className={styles.sectionTitle}>会话历史</div>}

        <div className={listClassName}>
          {shouldShowBlockingState && <div className={styles.loading}>加载中...</div>}

          {!shouldShowBlockingState && error && !hasAnySessions && (
            <div className={styles.error}>
              <div>{error}</div>
              <button onClick={() => void loadSessions()} className={styles.retryButton}>
                重试
              </button>
            </div>
          )}

          {!shouldShowBlockingState && shouldShowEmptyState && <div className={styles.empty}>暂无会话记录</div>}

          {!error && shouldShowList && (
            <div className={contentClassName}>
              {renderSection('今天', sessions.today)}
              {renderSection('7天内', sessions.within7Days, sessions.today.length > 0)}
              {renderSection('7天外', sessions.beyond7Days, sessions.today.length > 0 || sessions.within7Days.length > 0)}
            </div>
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
