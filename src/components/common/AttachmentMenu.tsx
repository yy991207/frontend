import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CloseOutlined,
  FileAddOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import styles from './AttachmentMenu.module.less'

export type AttachmentSkillItem = {
  id: string
  skillName: string
  title: string
  description: string
  isSelected: boolean
}

type AttachmentMenuProps = {
  placement: 'top' | 'bottom'
  skills: AttachmentSkillItem[]
  skillsLoading: boolean
  loadSkills: (signal?: AbortSignal) => Promise<void>
  onSelectSkill: (skill: AttachmentSkillItem) => void
  onManageSkills: () => void
  showTools?: boolean
  webSearchEnabled?: boolean
  knowledgeEnabled?: boolean
  onToggleWebSearch?: () => void
  onToggleKnowledge?: () => void
}

const ATTACHMENT_ACTIONS = [
  { key: 'upload', label: '上传文件或图片', icon: <PaperClipOutlined /> },
  { key: 'doc', label: '添加飞书云文档', icon: <FileAddOutlined /> },
  { key: 'skill', label: '技能', icon: <ThunderboltOutlined />, hasArrow: true },
  { key: 'tool', label: '工具', icon: <ToolOutlined />, hasArrow: true },
]

export function AttachmentMenu({
  placement,
  skills,
  skillsLoading,
  loadSkills,
  onSelectSkill,
  onManageSkills,
  showTools = false,
  webSearchEnabled = false,
  knowledgeEnabled = false,
  onToggleWebSearch,
  onToggleKnowledge,
}: AttachmentMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const [toolInfoOpen, setToolInfoOpen] = useState(false)
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const [skillSearchQuery, setSkillSearchQuery] = useState('')

  const filteredSkills = useMemo(() => {
    if (!skillSearchQuery.trim()) {
      return skills
    }

    const query = skillSearchQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.skillName.toLowerCase().includes(query),
    )
  }, [skillSearchQuery, skills])

  useEffect(() => {
    if (!skillMenuOpen) {
      return
    }

    const controller = new AbortController()
    void loadSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadSkills, skillMenuOpen])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        setToolMenuOpen(false)
        setToolInfoOpen(false)
        setSkillMenuOpen(false)
        setSkillSearchQuery('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  return (
    <div ref={rootRef} className={`${styles.root} ${placement === 'top' ? styles.placementTop : styles.placementBottom}`}>
      <button
        type="button"
        className={`${styles.trigger} ${menuOpen ? styles.triggerActive : ''}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((value) => !value)}
      >
        {menuOpen ? <CloseOutlined /> : <PlusOutlined />}
      </button>

      {!menuOpen ? <div className={styles.tooltip}>上传附件/技能等</div> : null}

      <div className={`${styles.menuSurface} ${menuOpen ? styles.menuSurfaceOpen : ''}`} role="menu">
        {ATTACHMENT_ACTIONS.filter((action) => showTools || action.key !== 'tool').map((action) =>
          action.key === 'tool' ? (
            <button
              key={action.key}
              type="button"
              className={`${styles.menuItem} ${toolMenuOpen ? styles.menuItemActive : ''}`}
              onMouseEnter={() => {
                setToolMenuOpen(true)
                setSkillMenuOpen(false)
              }}
            >
              <span className={styles.menuMain}>
                <span className={styles.menuIcon}>{action.icon}</span>
                <span>{action.label}</span>
              </span>
              <RightOutlined className={styles.menuArrow} />
            </button>
          ) : action.key === 'skill' ? (
            <button
              key={action.key}
              type="button"
              className={`${styles.menuItem} ${skillMenuOpen ? styles.menuItemActive : ''}`}
              onMouseEnter={() => {
                setSkillMenuOpen(true)
                setToolMenuOpen(false)
              }}
            >
              <span className={styles.menuMain}>
                <span className={styles.menuIcon}>{action.icon}</span>
                <span>{action.label}</span>
              </span>
              <RightOutlined className={styles.menuArrow} />
            </button>
          ) : (
            <button
              key={action.key}
              type="button"
              className={styles.menuItem}
              onMouseEnter={() => {
                setToolMenuOpen(false)
                setSkillMenuOpen(false)
              }}
            >
              <span className={styles.menuMain}>
                <span className={styles.menuIcon}>{action.icon}</span>
                <span>{action.label}</span>
              </span>
            </button>
          ),
        )}

        <div className={`${styles.submenu} ${skillMenuOpen ? styles.submenuOpen : ''}`}>
          <div className={styles.submenuHeader}>
            <span>技能</span>
          </div>
          <div className={styles.searchBox}>
            <SearchOutlined className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="搜索技能"
              value={skillSearchQuery}
              onChange={(event) => setSkillSearchQuery(event.target.value)}
            />
          </div>
          <div className={styles.skillList}>
            {skillsLoading ? (
              <div className={styles.loading}>加载中...</div>
            ) : filteredSkills.length === 0 ? (
              <div className={styles.empty}>{skillSearchQuery ? '未找到匹配的技能' : '暂无技能'}</div>
            ) : (
              filteredSkills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className={styles.skillItem}
                  onClick={() => {
                    setMenuOpen(false)
                    setSkillMenuOpen(false)
                    setSkillSearchQuery('')
                    onSelectSkill(skill)
                  }}
                >
                  <div className={styles.skillItemIcon}>
                    <ThunderboltOutlined />
                  </div>
                  <div className={styles.skillItemInfo}>
                    <div className={styles.skillItemTitle}>{skill.title}</div>
                    <div className={styles.skillItemDesc}>{skill.description}</div>
                  </div>
                </button>
              ))
            )}
          </div>
          <button type="button" className={styles.manageButton} onClick={onManageSkills}>
            <span className={styles.menuMain}>
              <span className={styles.toolItemMain}>
                <SettingOutlined />
                <span>管理技能</span>
              </span>
            </span>
          </button>
        </div>

        {showTools ? (
          <div className={`${styles.submenu} ${toolMenuOpen ? styles.submenuOpen : ''}`}>
            <div className={styles.submenuHeader}>
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
                onClick={onToggleWebSearch}
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
                onClick={onToggleKnowledge}
              >
                <span className={styles.switchThumb} />
              </button>
            </div>

            <button type="button" className={styles.toolManageButton}>
              <span className={styles.menuMain}>
                <span className={styles.toolItemMain}>
                  <SettingOutlined />
                  <span>工具管理</span>
                </span>
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
