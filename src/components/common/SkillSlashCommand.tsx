import { useEffect, useRef } from 'react'
import { SearchOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { SkillItem } from '../../services/skillPromptService'
import styles from './SkillSlashCommand.module.less'

export type SkillSlashCommandProps = {
  /** 是否显示浮层 */
  visible: boolean
  /** 当前搜索关键词 */
  query: string
  /** 设置搜索关键词 */
  setQuery: (query: string) => void
  /** 技能列表 */
  skills: SkillItem[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error?: string
  /** 当前选中索引 */
  selectedIndex: number
  /** 选择技能回调 */
  onSelectSkill: (skill: SkillItem) => void
  /** 关闭浮层回调 */
  onClose: () => void
  /** 跳转到管理技能页面 */
  onManageSkills: () => void
  /** 重试加载 */
  onRetry?: () => void
  /** 展示风格 */
  variant?: 'default' | 'agentConversation'
}

export function SkillSlashCommand(props: SkillSlashCommandProps) {
  const {
    visible,
    query,
    setQuery,
    skills,
    loading,
    error,
    selectedIndex,
    onSelectSkill,
    onClose,
    onManageSkills,
    onRetry,
    variant = 'default',
  } = props

  const listRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)
  const isAgentConversation = variant === 'agentConversation'

  // 选中项滚动到可视区域
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedIndex])

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const root = document.querySelector('[data-skill-slash-root]')
      if (root && !root.contains(target)) {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [visible, onClose])

  if (!visible) return null

  const isEmpty = !loading && !error && skills.length === 0

  const renderListContent = () => {
    if (loading) {
      return (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span>加载技能列表...</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className={styles.error}>
          <div className={styles.errorIcon}>!</div>
          <p className={styles.errorText}>{error}</p>
          <p className={styles.errorHint}>请检查网络连接后重试</p>
          {onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              重试
            </button>
          )}
        </div>
      )
    }

    if (isEmpty) {
      return (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <ThunderboltOutlined />
          </div>
          <p className={styles.emptyText}>
            {query ? '未找到匹配的技能' : '暂无技能'}
          </p>
          {!query && !isAgentConversation ? <p className={styles.emptyHint}>点击"管理技能"添加或创建技能</p> : null}
        </div>
      )
    }

    return skills.map((skill, index) => (
      <button
        key={skill.id}
        ref={index === selectedIndex ? selectedItemRef : null}
        type="button"
        className={`${styles.skillItem} ${index === selectedIndex ? styles.skillItemSelected : ''}`}
        onClick={() => onSelectSkill(skill)}
        onMouseEnter={() => {
          // 鼠标悬停时更新选中索引
          // 这里通过父组件的 setSelectedIndex 实现
        }}
        title={skill.description || ''}
      >
        <div className={styles.skillItemIcon}>
          <ThunderboltOutlined />
        </div>
        <div className={styles.skillItemContent}>
          <div className={styles.skillItemTitle}>{skill.title}</div>
          {isAgentConversation && skill.description ? (
            <div className={styles.skillItemSummary}>{skill.description}</div>
          ) : null}
        </div>
      </button>
    ))
  }

  const renderSearchBox = () => (
    <div className={styles.searchBox}>
      <SearchOutlined className={styles.searchIcon} />
      <input
        type="text"
        className={styles.searchInput}
        placeholder="搜索技能..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
    </div>
  )

  const renderFooter = () => (
    <div className={styles.footer}>
      <div className={styles.shortcutHint}>
        <span className={styles.shortcutKey}>↑</span>
        <span className={styles.shortcutKey}>↓</span>
        <span>导航</span>
        <span className={styles.shortcutKey}>Enter</span>
        <span>选择</span>
        <span className={styles.shortcutKey}>Esc</span>
        <span>关闭</span>
      </div>
      <button
        type="button"
        className={`${styles.manageButton} ${isAgentConversation ? styles.manageButtonIconOnly : ''}`}
        aria-label={isAgentConversation ? '管理技能' : undefined}
        data-tooltip={isAgentConversation ? '管理技能' : undefined}
        onClick={onManageSkills}
      >
        <SettingOutlined />
        {isAgentConversation ? null : <span>管理技能</span>}
      </button>
    </div>
  )

  return (
    <div className={`${styles.root} ${isAgentConversation ? styles.rootAgentConversation : ''}`} data-skill-slash-root>
      {isAgentConversation ? (
        <div className={`${styles.skillList} ${styles.skillListAgentConversation}`} ref={listRef}>
          {renderListContent()}
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <h3 className={styles.title}>选择技能</h3>
          </div>
          {renderSearchBox()}
          <div className={styles.skillList} ref={listRef}>
            {renderListContent()}
          </div>
          {renderFooter()}
        </>
      )}
    </div>
  )
}
