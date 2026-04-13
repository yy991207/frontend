import { useState, useEffect, useRef } from 'react'
import {
  BookOutlined,
  CompassOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  UserOutlined,
  MessageOutlined,
  EditOutlined,
  FileTextOutlined,
  CameraOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import chatConfigText from '../../../config.yaml?raw'
import homeAvatar from '../../assets/home-avatar.png'
import { createNewChatPagePath } from '../../services/chatService'
import { loadCustomAgentApiConfig, getAgentUsageLogs, type AgentUsageLogItem } from '../../services/customAgentService'
import { parseChatSessionConfig, findLatestEmptySession } from '../../services/chatSessionService'
import ChatSessionHistory from '../ChatSessionHistory/ChatSessionHistory'
import styles from './sidebar.module.less'

// 智能体列表数据
const AGENT_ITEMS = [
  { id: '1', name: '学习公社6.0答疑助手', icon: <MessageOutlined /> },
  { id: '2', name: '运营达人', icon: <EditOutlined /> },
  { id: '3', name: '财报解读专家', icon: <FileTextOutlined /> },
  { id: '4', name: '修图小助手，相册中不再有废片！', icon: <CameraOutlined /> },
]

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

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [expanded, setExpanded] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [agentList, setAgentList] = useState<AgentUsageLogItem[]>([])
  const [agentLoading, setAgentLoading] = useState(false)
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const agentRowRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const agentListRef = useRef<HTMLDivElement>(null)
  const [agentListScrolling, setAgentListScrolling] = useState(false)
  const agentListScrollTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAgents() {
      setAgentLoading(true)
      try {
        const config = await loadCustomAgentApiConfig()
        const logs = await getAgentUsageLogs(config)
        if (!cancelled) {
          setAgentList(logs)
        }
      } catch (error) {
        console.error('获取智能体使用日志失败:', error)
      } finally {
        if (!cancelled) {
          setAgentLoading(false)
        }
      }
    }

    fetchAgents()

    return () => {
      cancelled = true
    }
  }, [])

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

  const handleAgentHover = (agentId: string, event: React.MouseEvent) => {
    setHoveredAgentId(agentId)
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    })
  }

  const handleAgentLeave = () => {
    setHoveredAgentId(null)
  }

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
          agentList.map((agent, index) => (
            <button
              key={agent.agent_id}
              type="button"
              className={`${styles.agentRow} ${styles.tooltipTarget}`}
              ref={(el) => {
                if (el) agentRowRefs.current.set(agent.agent_id, el)
              }}
              onMouseEnter={(e) => handleAgentHover(agent.agent_id, e)}
              onMouseLeave={handleAgentLeave}
              onClick={() => navigate(`/agent/${agent.agent_id}/chat`)}
            >
              <span className={styles.iconCell}>{getAgentIcon(index)}</span>
              <span className={styles.labelCell}>{agent.agent_name}</span>
            </button>
          ))
        ) : (
          AGENT_ITEMS.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`${styles.agentRow} ${styles.tooltipTarget}`}
              data-tooltip={agent.name}
              onClick={() => navigate('/agent/1')}
            >
              <span className={styles.iconCell}>{agent.icon}</span>
              <span className={styles.labelCell}>{agent.name}</span>
            </button>
          ))
        )}
      </div>

      {/* 悬浮提示窗 */}
      {hoveredAgentId && (
        <div
          className={styles.agentTooltip}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          {agentList.find((a) => a.agent_id === hoveredAgentId)?.agent_name || ''}
        </div>
      )}

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
