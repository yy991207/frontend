import { useState } from 'react'
import {
  AppstoreAddOutlined,
  BookOutlined,
  CompassOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import homeAvatar from '../../assets/home-avatar.png'
import styles from './sidebar.module.less'

const NAV_ITEMS = [
  { key: 'home', label: '新建', icon: <PlusOutlined /> },
  { key: 'library', label: '库', icon: <BookOutlined />, path: '/library' },
  { key: 'skills', label: '技能', icon: <ThunderboltOutlined />, path: '/skills' },
  { key: 'discover', label: '发现', icon: <CompassOutlined /> },
  { key: 'apps', label: '开发应用', icon: <AppstoreAddOutlined /> },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [expanded, setExpanded] = useState(false)

  const isActive = (path?: string) => (path ? location.pathname === path : false)

  const handleItemClick = (path?: string) => {
    if (path) {
      navigate(path)
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
          <span className={styles.brandName}>果仁助手</span>
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
            onClick={() => handleItemClick(item.path)}
            data-tooltip={item.label}
          >
            <span className={styles.iconCell}>{item.icon}</span>
            <span className={styles.labelCell}>{item.label}</span>
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
