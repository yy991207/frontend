import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  BookOutlined,
  CompassOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import chatConfigText from '../../../config.yaml?raw'
import { createNewChatPagePath } from '../../services/chatService'
import { loadCustomAgentApiConfig, getAgentUsageLogs, deleteAgentUsageLog, type AgentUsageLogItem, type CustomAgentApiConfig } from '../../services/customAgentService'
import { parseChatSessionConfig, findLatestEmptySession } from '../../services/chatSessionService'
import { AGENT_USAGE_LOG_REFRESH_EVENT } from '../../services/chatSessionEvents'
import ChatSessionHistory from '../ChatSessionHistory/ChatSessionHistory'
import { DeleteConfirmModal } from '../common/DeleteConfirmModal'
import { getAvatarLetter, normalizeAgentAvatarUrl } from '../../utils/agentAvatar'
import styles from './sidebar.module.less'

const NAV_ITEMS = [
  { key: 'home', label: '新建', icon: <PlusOutlined /> },
  { key: 'library', label: '库', icon: <BookOutlined />, path: '/library' },
  { key: 'skills', label: '技能', icon: <ThunderboltOutlined />, path: '/skills' },
  { key: 'discover', label: '发现', icon: <CompassOutlined />, path: '/discover' },
]

const AILY_LOGO_URL = 'https://aily.feishu.cn/play/api/v1/files/static/offcial-logo15.png'
const PARTNER_AVATAR_URL = 'https://s3-imfile.feishucdn.com/static-resource/v1/v3_00vn_7af88321-f0ad-4b2d-9e0f-f1fc704abbag'
const CURRENT_SIDEBAR_ITEM_STYLE = {
  backgroundColor: '#ffffff',
  color: '#1f2329',
}

export function shouldUseCreateAsCurrent(pathname: string, href?: string) {
  return pathname === '/' && href === 'http://192.168.61.219:5173/'
}

function AgentAvatar({ agent }: { agent: AgentUsageLogItem }) {
  const avatarUrl = normalizeAgentAvatarUrl(agent.avatar_url)
  const letter = getAvatarLetter(agent.agent_name)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="agent logo"
        className={styles.avatarImage}
        onError={(e) => {
          // 图片加载失败时，隐藏 img 并显示首字母
          e.currentTarget.style.display = 'none'
          const parent = e.currentTarget.parentElement
          if (parent) {
            parent.innerHTML = `<span class="${styles.avatarLetter}">${letter}</span>`
          }
        }}
      />
    )
  }

  return <span className={styles.avatarLetter}>{letter}</span>
}

interface AgentMenuProps {
  agent: AgentUsageLogItem
  onDelete: (agent: AgentUsageLogItem) => void
}

function AgentMenu({ agent, onDelete }: AgentMenuProps) {
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
    onDelete(agent)
    setIsOpen(false)
  }

  const dropdownContent = isOpen && dropdownPosition ? (
    <div
      ref={dropdownRef}
      className={styles.agentMenuDropdown}
      style={{
        position: 'fixed',
        top: `${dropdownPosition.top}px`,
        right: `${dropdownPosition.right}px`,
      }}
    >
      <button type="button" className={styles.agentMenuItem} onClick={handleDelete}>
        <DeleteOutlined className={styles.agentMenuItemIcon} />
        <span className={styles.agentMenuItemText}>删除</span>
      </button>
    </div>
  ) : null

  return (
    <div className={styles.agentMenuContainer} ref={menuRef}>
      <button
        type="button"
        className={styles.agentMoreButton}
        ref={buttonRef}
        onClick={handleToggle}
      >
        <MoreOutlined />
      </button>

      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  )
}

export default function Sidebar() {

  const navigate = useNavigate()
  const location = useLocation()
  const [expanded, setExpanded] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const [agentList, setAgentList] = useState<AgentUsageLogItem[]>([])
  const [agentLoading, setAgentLoading] = useState(false)
  const [deleteTargetAgent, setDeleteTargetAgent] = useState<AgentUsageLogItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [removingAgentIds, setRemovingAgentIds] = useState<Set<string>>(new Set())
  const [agentConfig, setAgentConfig] = useState<CustomAgentApiConfig | null>(null)
  const agentListRef = useRef<HTMLDivElement>(null)
  const [agentListScrolling, setAgentListScrolling] = useState(false)
  const agentListScrollTimeoutRef = useRef<number | null>(null)
  const hasLoadedOnceRef = useRef(false)

  const fetchAgents = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    try {
      if (!silent) {
        setAgentLoading(true)
      }
      const config = await loadCustomAgentApiConfig()
      setAgentConfig(config)
      const logs = await getAgentUsageLogs(config)
      setAgentList(logs)
      hasLoadedOnceRef.current = true
    } catch (error) {
      console.error('获取智能体使用日志失败:', error)
    } finally {
      if (!silent) {
        setAgentLoading(false)
      }
    }
  }, [])

  // 静默预加载，避免首屏闪烁
  useEffect(() => {
    if (hasLoadedOnceRef.current) return
    void fetchAgents({ silent: true })
  }, [fetchAgents])

  useEffect(() => {
    const handleRefresh = () => {
      void fetchAgents({ silent: true })
    }

    window.addEventListener(AGENT_USAGE_LOG_REFRESH_EVENT, handleRefresh)

    return () => {
      window.removeEventListener(AGENT_USAGE_LOG_REFRESH_EVENT, handleRefresh)
    }
  }, [fetchAgents])

  const handleDeleteAgent = async (agent: AgentUsageLogItem) => {
    if (!agentConfig) return

    try {
      setDeleteLoading(true)
      setRemovingAgentIds((prev) => new Set(prev).add(agent.agent_id))

      await deleteAgentUsageLog(agentConfig, agent.agent_id)

      setRemovingAgentIds((prev) => {
        const next = new Set(prev)
        next.delete(agent.agent_id)
        return next
      })

      // 静默刷新，避免闪烁
      await fetchAgents({ silent: true })
      setDeleteTargetAgent(null)
    } catch (error) {
      setRemovingAgentIds((prev) => {
        const next = new Set(prev)
        next.delete(agent.agent_id)
        return next
      })
      console.error('删除智能体使用记录失败:', error)
      alert(error instanceof Error ? error.message : '删除智能体使用记录失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  useEffect(() => {
    const listEl = agentListRef.current
    if (!listEl) return

    const handleScroll = () => {
      setAgentListScrolling(true)
      if (agentListScrollTimeoutRef.current) {
        clearTimeout(agentListScrollTimeoutRef.current)
      }
      agentListScrollTimeoutRef.current = window.setTimeout(() => {
        setAgentListScrolling(false)
      }, 800)
    }

    listEl.addEventListener('scroll', handleScroll)
    return () => {
      listEl.removeEventListener('scroll', handleScroll)
      if (agentListScrollTimeoutRef.current) {
        clearTimeout(agentListScrollTimeoutRef.current)
      }
    }
  }, [])

  const isCreateCurrent = shouldUseCreateAsCurrent(
    location.pathname,
    typeof window !== 'undefined' ? window.location.href : undefined,
  )
  const isActive = (itemKey: string, path?: string) => {
    if (itemKey === 'home') {
      return isCreateCurrent
    }
    return path ? location.pathname === path : false
  }
  const isAgentActive = (agentId: string) => {
    const currentSessionId = new URLSearchParams(location.search).get('sessionId')
    if (currentSessionId) {
      return false
    }
    const agentBasePath = `/agent/${agentId}`
    return location.pathname === agentBasePath || location.pathname === `${agentBasePath}/chat`
  }

  const handleItemClick = (path?: string) => {
    if (path) {
      navigate(path)
    }
  }

  const handleCreateSession = async () => {
    if (creatingSession) {
      return
    }

    setCreatingSession(true)

    try {
      let sessionConfig = parseChatSessionConfig(chatConfigText)
      const existingEmptySessionId = await findLatestEmptySession(sessionConfig)
      
      if (existingEmptySessionId) {
        navigate('/', { state: null })
      } else {
        await createNewChatPagePath(chatConfigText)
        navigate('/', { state: null })
      }
    } catch (error) {
      console.error('创建会话失败:', error)
      alert(error instanceof Error ? error.message : '创建会话失败，请稍后重试')
    } finally {
      setCreatingSession(false)
    }
  }

  return (
    <aside className={`${styles.sidebar} ${expanded ? styles.sidebarExpanded : styles.sidebarCollapsed}`}>
      <div className={styles.sidebarInner}>
        <div className={styles.topRow}>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.tooltipTarget}`}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? '收起侧边栏' : '展开侧边栏'}
            data-tooltip={expanded ? '收起侧边栏' : '展开侧边栏'}
          >
            {expanded ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          </button>
          <button
            type="button"
            className={styles.panelHead}
            onClick={() => navigate('/')}
            aria-label="返回果仁首页"
          >
            <span className={styles.brandAvatarWrap}>
              <img src={AILY_LOGO_URL} alt="果仁" className={styles.brandAvatar} />
            </span>
            <span className={styles.brandName}>果仁</span>
          </button>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.key, item.path)
            return (
              <button
                key={item.key}
                type="button"
                className={`${styles.navRow} ${styles.tooltipTarget} ${active ? styles.sidebarItemActive : ''}`}
                onClick={() => {
                  if (item.key === 'home') {
                    void handleCreateSession()
                    return
                  }

                  handleItemClick(item.path)
                }}
                data-tooltip={item.key === 'home' && creatingSession ? '新建中...' : item.label}
                aria-busy={item.key === 'home' ? creatingSession : undefined}
                aria-current={active ? 'page' : undefined}
                style={active ? CURRENT_SIDEBAR_ITEM_STYLE : undefined}
              >
                <span className={styles.iconCell}>
                  {item.key === 'home' && creatingSession ? <LoadingOutlined /> : item.icon}
                </span>
                <span className={styles.labelCell}>{item.key === 'home' && creatingSession ? '新建中...' : item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className={styles.sectionTitle}>智能伙伴</div>
        <button
          type="button"
          className={`${styles.partnerRow} ${styles.tooltipTarget} ${location.pathname === '/partner' ? styles.sidebarItemActive : ''}`}
          data-tooltip="你的智能伙伴"
          onClick={() => navigate('/partner')}
          aria-current={location.pathname === '/partner' ? 'page' : undefined}
          style={location.pathname === '/partner' ? CURRENT_SIDEBAR_ITEM_STYLE : undefined}
        >
          <span className={styles.avatarCell}>
            <img src={PARTNER_AVATAR_URL} alt="智能伙伴头像" className={styles.avatarImage} />
          </span>
          <span className={styles.labelCell}>你的智能伙伴</span>
        </button>

        <div className={styles.lowerSection}>
          <div className={styles.sectionTitle}>智能体</div>
          <div
            ref={agentListRef}
            data-testid="sidebar-agent-list"
            data-sidebar-mode={expanded ? 'expanded' : 'collapsed'}
            className={`${styles.agentList} ${agentListScrolling ? styles.scrolling : ''}`}
          >
            {agentLoading ? (
              <div className={styles.agentLoading}>
                <LoadingOutlined />
              </div>
            ) : agentList.length > 0 ? (
              agentList.map((agent) => {
                const isRemoving = removingAgentIds.has(agent.agent_id)
                const active = isAgentActive(agent.agent_id)
                return (
                  <div
                    key={agent.agent_id}
                    className={`${styles.agentRow} ${active ? styles.sidebarItemActive : ''} ${isRemoving ? styles.agentRowRemoving : ''}`}
                    onClick={() => navigate(`/agent/${agent.agent_id}/chat`)}
                    aria-current={active ? 'page' : undefined}
                    style={active ? CURRENT_SIDEBAR_ITEM_STYLE : undefined}
                  >
                    <div className={styles.agentRowMain}>
                      <span className={styles.avatarCell}>
                        <AgentAvatar agent={agent} />
                      </span>
                      <span className={styles.agentNameText}>{agent.agent_name}</span>
                    </div>
                    {expanded ? <AgentMenu agent={agent} onDelete={setDeleteTargetAgent} /> : null}
                  </div>
                )
              })
            ) : (
              <div className={styles.agentEmpty}>暂无智能体使用记录</div>
            )}
          </div>

          <div
            data-testid="sidebar-session-history-wrapper"
            data-sidebar-mode={expanded ? 'expanded' : 'collapsed'}
            className={styles.sessionHistoryWrapper}
          >
            <ChatSessionHistory expanded={expanded} />
          </div>
        </div>

        <DeleteConfirmModal
          open={Boolean(deleteTargetAgent)}
          title="删除智能体使用记录"
          description="是否确认删除该智能体使用记录？"
          loading={deleteLoading}
          onCancel={() => setDeleteTargetAgent(null)}
          onConfirm={() => {
            if (deleteTargetAgent) {
              void handleDeleteAgent(deleteTargetAgent)
            }
          }}
        />
      </div>
    </aside>
  )
}
