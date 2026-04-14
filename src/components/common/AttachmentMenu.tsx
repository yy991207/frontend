import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ALLOWED_FILE_EXTENSIONS } from '../../services/ossUploadService'
import styles from './AttachmentMenu.module.less'

type SubmenuKey = 'skill' | 'tool' | null

export type AttachmentSkillItem = {
  id: string
  skillName: string
  title: string
  description: string
  template: string
  isSelected: boolean
}

type AttachmentMenuProps = {
  placement: 'top' | 'bottom'
  skills: AttachmentSkillItem[]
  skillsLoading: boolean
  loadSkills: (signal?: AbortSignal) => Promise<void>
  onSelectSkill: (skill: AttachmentSkillItem) => void
  onManageSkills: () => void
  onUploadFile?: () => void
  showTools?: boolean
  webSearchEnabled?: boolean
  webSearchLocked?: boolean
  knowledgeEnabled?: boolean
  onToggleWebSearch?: () => void
  onToggleKnowledge?: () => void
  hideManageSkills?: boolean
}

const ATTACHMENT_ACTIONS = [
  { key: 'upload', label: '上传文档', icon: <PaperClipOutlined /> },
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
  onUploadFile,
  showTools = false,
  webSearchEnabled = false,
  webSearchLocked = false,
  knowledgeEnabled = false,
  onToggleWebSearch,
  onToggleKnowledge,
  hideManageSkills = false,
}: AttachmentMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuKey>(null)
  const [toolInfoOpen, setToolInfoOpen] = useState(false)
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
    if (activeSubmenu !== 'skill') {
      return
    }

    const controller = new AbortController()
    void loadSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [activeSubmenu, loadSkills])

  const closeAllMenus = useCallback(() => {
    setMenuOpen(false)
    setActiveSubmenu(null)
    setToolInfoOpen(false)
    setSkillSearchQuery('')
  }, [])

  const handleSubmenuChange = (nextSubmenu: Exclude<SubmenuKey, null>) => {
    // 子菜单共用一个稳定外壳，切换时只替换内容，避免两个浮层交叉淡出时露出背景。
    setActiveSubmenu(nextSubmenu)

    if (nextSubmenu !== 'tool') {
      setToolInfoOpen(false)
    }
  }

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeAllMenus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [closeAllMenus])

  const handleActionClick = (actionKey: string) => {
    if (actionKey === 'upload') {
      closeAllMenus()
      onUploadFile?.()
    }
  }

  return (
    <div ref={rootRef} className={`${styles.root} ${placement === 'top' ? styles.placementTop : styles.placementBottom}`}>
      <button
        type="button"
        className={`${styles.trigger} ${menuOpen ? styles.triggerActive : ''}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => {
          if (menuOpen) {
            closeAllMenus()
            return
          }

          setMenuOpen(true)
        }}
      >
        {menuOpen ? <CloseOutlined /> : <PlusOutlined />}
      </button>

      {!menuOpen ? <div className={styles.tooltip}>上传附件/技能等</div> : null}

      <div className={`${styles.menuSurface} ${menuOpen ? styles.menuSurfaceOpen : ''}`} role="menu">
        {ATTACHMENT_ACTIONS.filter((action) => showTools || action.key !== 'tool').map((action) =>
          action.key === 'upload' ? (
            <div key={action.key} className={styles.menuItemWrapper}>
              <button
                type="button"
                className={styles.menuItem}
                onMouseEnter={() => {
                  setActiveSubmenu(null)
                  setToolInfoOpen(false)
                }}
                onClick={() => handleActionClick(action.key)}
              >
                <span className={styles.menuMain}>
                  <span className={styles.menuIcon}>{action.icon}</span>
                  <span>{action.label}</span>
                </span>
              </button>
              <div className={styles.formatTooltip}>
                支持格式：{ALLOWED_FILE_EXTENSIONS.join('、')}
              </div>
            </div>
          ) : action.key === 'tool' ? (
            <button
              key={action.key}
              type="button"
              className={`${styles.menuItem} ${activeSubmenu === 'tool' ? styles.menuItemActive : ''}`}
              onMouseEnter={() => handleSubmenuChange('tool')}
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
              className={`${styles.menuItem} ${activeSubmenu === 'skill' ? styles.menuItemActive : ''}`}
              onMouseEnter={() => handleSubmenuChange('skill')}
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
                setActiveSubmenu(null)
                setToolInfoOpen(false)
              }}
              onClick={() => handleActionClick(action.key)}
            >
              <span className={styles.menuMain}>
                <span className={styles.menuIcon}>{action.icon}</span>
                <span>{action.label}</span>
              </span>
            </button>
          ),
        )}

        <div
          data-testid="attachment-submenu-surface"
          className={`${styles.submenu} ${activeSubmenu ? styles.submenuOpen : ''}`}
          aria-hidden={!activeSubmenu}
        >
          {activeSubmenu ? (
            <div key={activeSubmenu} className={styles.submenuPane}>
              {activeSubmenu === 'skill' ? (
                <div className={styles.skillPane}>
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
                  <div className={styles.skillViewport} data-testid="attachment-skill-viewport">
                    {skillsLoading ? (
                      <div className={styles.loading} data-testid="attachment-skill-loading">
                        加载中...
                      </div>
                    ) : filteredSkills.length === 0 ? (
                      <div className={styles.empty}>{skillSearchQuery ? '未找到匹配的技能' : '暂无技能'}</div>
                    ) : (
                      <div className={styles.skillList}>
                        {filteredSkills.map((skill) => (
                          <button
                            key={skill.id}
                            type="button"
                            className={styles.skillItem}
                            onClick={() => {
                              closeAllMenus()
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
                        ))}
                      </div>
                    )}
                  </div>
                  {hideManageSkills ? null : (
                    <button type="button" className={styles.manageButton} onClick={onManageSkills}>
                      <span className={styles.menuMain}>
                        <span className={styles.toolItemMain}>
                          <SettingOutlined />
                          <span>管理技能</span>
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              ) : showTools ? (
                <>
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
                      className={`${styles.switchButton} ${webSearchEnabled ? styles.switchButtonOn : ''} ${webSearchLocked ? styles.switchButtonLocked : ''}`}
                      onClick={webSearchLocked ? undefined : onToggleWebSearch}
                      disabled={webSearchLocked}
                    >
                      <span className={styles.switchThumb} />
                      {webSearchLocked ? (
                        <svg className={styles.lockIcon} viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4 7V5a4 4 0 1 1 8 0v2h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V8a1 1 0 0 1-1-1H4zm1.5-2v2h5V5a2.5 2.5 0 0 0-5 0z" />
                        </svg>
                      ) : null}
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
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
