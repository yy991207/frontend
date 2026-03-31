import { AppstoreOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './sidebar.module.less'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <AppstoreOutlined style={{ fontSize: 20, color: '#6b7280' }} />
        <span>飞书 aily</span>
      </div>

      {/* 导航区 */}
      <nav className={styles.nav}>
        {/* 新建 */}
        <button
          className={`${styles.navItem} ${styles.newBtn}`}
          onClick={() => console.log('新建')}
        >
          <span className={styles.navIcon}>
            <PlusOutlined />
          </span>
          新建
        </button>

        {/* 技能 */}
        <button
          className={`${styles.navItem} ${isActive('/skills') ? styles.navItemActive : ''}`}
          onClick={() => navigate('/skills')}
        >
          <span className={styles.navIcon}>
            <ThunderboltOutlined />
          </span>
          技能
        </button>
      </nav>
    </aside>
  )
}
