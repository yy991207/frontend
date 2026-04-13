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
  RobotOutlined,
  ThunderboltOutlined,
  UserOutlined,
  MessageOutlined,
  EditOutlined,
  FileTextOutlined,
  CameraOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import chatConfigText from '../../../config.yaml?raw'
import homeAvatar from '../../assets/home-avatar.png'
import { createNewChatPagePath } from '../../services/chatService'
import { loadCustomAgentApiConfig, getAgentUsageLogs, deleteAgentUsageLog, type AgentUsageLogItem, type CustomAgentApiConfig } from '../../services/customAgentService'
import { parseChatSessionConfig, findLatestEmptySession } from '../../services/chatSessionService'
import { AGENT_USAGE_LOG_REFRESH_EVENT } from '../../services/chatSessionEvents'
import ChatSessionHistory from '../ChatSessionHistory/ChatSessionHistory'
import { DeleteConfirmModal } from '../common/DeleteConfirmModal'
import styles from './sidebar.module.less'

const NAV_ITEMS = [
  { key: 'home', label: '新建', icon: <PlusOutlined /> },
  { key: 'discover', label: '发现', icon: <CompassOutlined />, path: '/discover' },
  { key: 'library', label: '库', icon: <BookOutlined />, path: '/library' },
  { key: 'skills', label: '技能', icon: <ThunderboltOutlined />, path: '/skills' },
]

function getAgentIcon(index: number) {
  const icons = [<MessageOutlined />, <EditOutlined />, <FileTextOutlined />, <CameraOutlined />]
  return icons[index % icons.length]
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
  const [expanded, setExpanded] = useState(false)
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

  const fetchAgents = useCallback(async () => {
    setAgentLoading(true)
    try {
      const config = await loadCustomAgentApiConfig()
      setAgentConfig(config)
      const logs = await getAgentUsageLogs(config)
      setAgentList(logs)
    } catch (error) {
      console.error('获取智能体使用日志失败:', error)
    } finally {
      setAgentLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAgents()
  }, [fetchAgents])

  useEffect(() => {
    const handleRefresh = () => {
      void fetchAgents()
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

      await fetchAgents()
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

  const isActive = (path?: string) => (path ? location.pathname === path : false)

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
    <aside className={`${styles.sidebar} ${expanded ? styles.sidebarExpanded : ''}`}>
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
          aria-label="返回果仁助手首页"
        >
          <span className={styles.brandAvatarWrap}>
            <img src={homeAvatar} alt="果仁助手头像" className={styles.brandAvatar} />
          </span>
          <span className={styles.brandName}>果仁智能体</span>
        </button>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.navRow} ${styles.tooltipTarget} ${isActive(item.path) ? styles.navRowActive : ''} ${
              item.key === 'home' ? styles.homeRow : ''
            }`}
            onClick={() => {
              if (item.key === 'home') {
                void handleCreateSession()
                return
              }

              handleItemClick(item.path)
            }}
            data-tooltip={item.key === 'home' && creatingSession ? '新建中...' : item.label}
            aria-busy={item.key === 'home' ? creatingSession : undefined}
          >
            <span className={styles.iconCell}>
              {item.key === 'home' && creatingSession ? <LoadingOutlined /> : item.icon}
            </span>
            <span className={styles.labelCell}>{item.key === 'home' && creatingSession ? '新建中...' : item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.sectionTitle}>智能伙伴</div>

      <button
        type="button"
        className={`${styles.partnerRow} ${styles.tooltipTarget} ${location.pathname === '/partner' ? styles.navRowActive : ''}`}
        data-tooltip="智能伙伴"
        onClick={() => navigate('/partner')}
      >
        <span className={styles.iconCell}>
          <RobotOutlined />
        </span>
        <span className={styles.labelCell}>智能伙伴</span>
      </button>

      {/* 智能体列表 */}
      <div className={styles.sectionTitle}>智能体</div>
      <div ref={agentListRef} className={`${styles.agentList} ${agentListScrolling ? styles.scrolling : ''}`}>
        {agentLoading ? (
          <div className={styles.agentLoading}>
            <LoadingOutlined />
          </div>
        ) : agentList.length > 0 ? (
          agentList.map((agent, index) => {
            const isRemoving = removingAgentIds.has(agent.agent_id)
            return (
              <div
                key={agent.agent_id}
                className={`${styles.agentRow} ${styles.agentRowWithMenu} ${isRemoving ? styles.agentRowRemoving : ''}`}
                onClick={() => navigate(`/agent/${agent.agent_id}/chat`)}
                style={{ cursor: 'pointer' }}
              >
                <span className={styles.iconCell}>{getAgentIcon(index)}</span>
                <span className={styles.labelCell}>
                  <span className={styles.agentNameText}>{agent.agent_name}</span>
                  <AgentMenu agent={agent} onDelete={setDeleteTargetAgent} />
                </span>
              </div>
            )
          })
        ) : (
          <div className={styles.agentEmpty}>暂无智能体使用记录</div>
        )}
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

      {/* 会话历史组件 */}
      <div className={styles.sessionHistoryWrapper}>
        <ChatSessionHistory expanded={expanded} />
      </div>

      <div className={styles.spacer} />

      {/* 底部这一行沿用同样的两列结构，保证展开时名字和工具按钮从图标轨道右侧拉开。 */}
      <div className={styles.footerRow}>
        <span className={styles.iconCell}>
          <UserOutlined />
        </span>
        <div className={styles.footerPanel}>
          <span className={styles.userName}>用户</span>
        </div>
      </div>
    </aside>
  )
}
