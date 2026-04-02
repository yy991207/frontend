import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Input, Tabs } from 'antd'
import {
  AudioOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  BookOutlined,
  CloseOutlined,
  DashboardOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  GlobalOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  SnippetsOutlined,
  TableOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import homeTabsUrl from '../../../mock_json/home-tabs.json?url'
import homeAvatar from '../../assets/home-avatar.png'
import chatConfigText from '../../../config.yaml?raw'
import { resolveQuickActionToolType } from '../../services/chatService'
import styles from './home.module.less'

type SkillItem = {
  id: string
  skillName: string
  title: string
  description: string
  isSelected: boolean
}

type SkillApiResponse = {
  success: boolean
  code: string
  msg: string
  data?: {
    skills?: unknown[]
    total?: number
  }
}

function parseSimpleYaml(rawText: string) {
  return rawText.split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return result
    }

    const separatorIndex = trimmedLine.indexOf(':')

    if (separatorIndex === -1) {
      return result
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

    if (key) {
      result[key] = value
    }

    return result
  }, {})
}

function buildAbsoluteUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function parseSkillApiConfig(rawText: string) {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const managePath = parsedConfig.view_user_skills_path
  const userId = parsedConfig.user_id
  const userIdParam = parsedConfig.skill_user_id_param

  if (!baseUrl || !managePath || !userId || !userIdParam) {
    throw new Error('config.yaml 缺少 url、view_user_skills_path、user_id 或 skill_user_id_param 配置')
  }

  const managePathWithUser = managePath.includes('{user_id}')
    ? managePath.replace('{user_id}', encodeURIComponent(userId))
    : managePath

  return {
    manageEndpoint: buildAbsoluteUrl(baseUrl, managePathWithUser),
    userId,
    userIdParam,
  }
}

function readSkillField(item: Record<string, unknown>, keys: string[]) {
  const value = keys.find((key) => typeof item[key] === 'string' && item[key])
  return value ? String(item[value]).trim() : ''
}

function normalizeSkillItems(items: unknown[]): SkillItem[] {
  return items
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const value = item as Record<string, unknown>
      const title = readSkillField(value, ['chinese_name', 'chinesename', 'chineseName', 'name'])
      const description = readSkillField(value, ['description', 'desc'])
      const skillName = readSkillField(value, ['skill_name', 'skillName', 'name'])

      if (!title) {
        return null
      }

      const id = readSkillField(value, ['id']) || skillName || `${title}-${index}`
      const isSelected = Boolean(value.is_selected ?? value.isSelected)

      return {
        id,
        skillName,
        title,
        description,
        isSelected,
      }
    })
    .filter((item): item is SkillItem => item !== null)
}

function extractSkillItemsFromResponse(data: SkillApiResponse) {
  const payload = data.data as Record<string, unknown> | undefined
  const skills = Array.isArray(payload?.skills)
    ? payload.skills
    : Array.isArray(payload?.items)
      ? payload.items
      : []

  return normalizeSkillItems(skills)
}

const QUICK_ACTIONS = [
  { icon: <BarChartOutlined />, label: '生成 PPT' },
  { icon: <BgColorsOutlined />, label: '生成创意 PPT' },
  { icon: <FileTextOutlined />, label: '写云文档' },
  { icon: <SnippetsOutlined />, label: '写报告' },
  { icon: <GlobalOutlined />, label: '搭建网页' },
  { icon: <DashboardOutlined />, label: '搭建仪表盘' },
  { icon: <TableOutlined />, label: '创建多维表格' },
  { icon: <PictureOutlined />, label: '生成图片' },
  { icon: <FileExcelOutlined />, label: 'Excel' },
  { icon: <MessageOutlined />, label: '对话模式' },
]

const ATTACHMENT_ACTIONS = [
  { key: 'upload', label: '上传文件或图片', icon: <PaperClipOutlined /> },
  { key: 'doc', label: '添加飞书云文档', icon: <FileAddOutlined /> },
  { key: 'skill', label: '技能', icon: <ThunderboltOutlined />, hasArrow: true },
  { key: 'tool', label: '工具', icon: <ToolOutlined />, hasArrow: true },
]

const DEFAULT_EMPTY_PROMPT_TEXT = '暂无指令，请在对话运行后创建指令'

type PracticeItem = {
  id: number
  coverClassName: string
  coverText: string
  title: string
  type: string
  views: string
  uses: string
}

type PromptItem = {
  id: number
  icon: string
  title: string
  summary: string
}

type PracticeTab = {
  key: string
  label: string
  contentType: 'practice-cards'
  items: PracticeItem[]
}

type PromptTab = {
  key: string
  label: string
  contentType: 'prompt-cards'
  items: PromptItem[]
  emptyText?: string
}

type HomeTab = PracticeTab | PromptTab

type HomeTabsMockData = {
  tabs: HomeTab[]
}

const DEFAULT_HOME_TABS: HomeTab[] = [
  {
    key: 'best-practice',
    label: '最佳实践',
    contentType: 'practice-cards',
    items: [],
  },
  {
    key: 'recommended-prompts',
    label: '推荐指令',
    contentType: 'prompt-cards',
    items: [],
  },
  {
    key: 'my-prompts',
    label: '我的指令',
    contentType: 'prompt-cards',
    emptyText: DEFAULT_EMPTY_PROMPT_TEXT,
    items: [],
  },
]

function getContentTypeIcon(type: string) {
  if (type === '图片') return <PictureOutlined />
  if (type === '云文档') return <FileTextOutlined />
  if (type === '报告') return <SnippetsOutlined />
  if (type === '仪表盘') return <DashboardOutlined />
  if (type === 'PPT') return <BarChartOutlined />
  return <BookOutlined />
}

export default function HomePage() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const [skillSearchQuery, setSkillSearchQuery] = useState('')
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [homeTabs, setHomeTabs] = useState<HomeTab[]>(DEFAULT_HOME_TABS)
  const [tabsLoading, setTabsLoading] = useState(true)
  const [tabsError, setTabsError] = useState('')
  const composerRef = useRef<HTMLDivElement | null>(null)

  const skillApiConfig = useMemo(() => {
    try {
      return parseSkillApiConfig(chatConfigText)
    } catch {
      return null
    }
  }, [])

  // 根据搜索关键词过滤技能列表
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
  }, [skills, skillSearchQuery])

  // 获取用户技能列表
  const fetchSkills = async (signal?: AbortSignal) => {
    if (!skillApiConfig) {
      setSkills([])
      return
    }

    setSkillsLoading(true)

    try {
      const requestUrl = new URL(skillApiConfig.manageEndpoint)
      requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)

      const response = await fetch(requestUrl.toString(), { signal })

      if (!response.ok) {
        throw new Error('技能接口请求失败')
      }

      const data = (await response.json()) as SkillApiResponse

      if (!data.success) {
        throw new Error(data.msg || '技能接口返回失败')
      }

      const nextSkills = extractSkillItemsFromResponse(data)
      setSkills(nextSkills)
    } catch {
      if (!signal?.aborted) {
        setSkills([])
      }
    } finally {
      if (!signal?.aborted) {
        setSkillsLoading(false)
      }
    }
  }

  // 打开技能菜单时加载技能列表
  useEffect(() => {
    if (!skillMenuOpen) {
      return
    }

    const controller = new AbortController()
    void fetchSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [skillMenuOpen])

  // 跳转到技能管理页面
  const handleManageSkills = () => {
    navigate('/skills')
  }

  // 选择技能后跳转到对话页面
  const handleSelectSkill = (skill: SkillItem) => {
    setSkillMenuOpen(false)
    setMenuOpen(false)
    setSkillSearchQuery('')
    navigate('/chat', {
      state: {
        initialPrompt: `使用技能：${skill.title}`,
        toolType: skill.skillName || skill.id,
      },
    })
  }

  // 输入区弹层点击外部自动关闭，避免菜单打开后一直停留在页面上。
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        setToolMenuOpen(false)
        setSkillMenuOpen(false)
        setSkillSearchQuery('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    let disposed = false

    // 首页三块内容统一从 mock_json 里读取，后面替换成真实接口时结构也能直接复用。
    const loadHomeTabs = async () => {
      try {
        const response = await fetch(homeTabsUrl)

        if (!response.ok) {
          throw new Error('mock json 请求失败')
        }

        const data = (await response.json()) as HomeTabsMockData

        if (disposed) {
          return
        }

        setHomeTabs(data.tabs)
        setTabsError('')
      } catch {
        if (disposed) {
          return
        }

        setHomeTabs(DEFAULT_HOME_TABS)
        setTabsError('首页内容加载失败，请检查 mock_json/home-tabs.json')
      } finally {
        if (!disposed) {
          setTabsLoading(false)
        }
      }
    }

    loadHomeTabs()

    return () => {
      disposed = true
    }
  }, [])

  const handleSend = () => {
    const value = prompt.trim()
    if (!value) return

    setPrompt('')
    navigate('/chat', {
      state: {
        initialPrompt: value,
        toolType: resolveQuickActionToolType(value),
      },
    })
  }

  const renderPracticeCards = (items: PracticeItem[]) => {
    if (tabsLoading) {
      return <div className={styles.emptyCommands}>内容加载中...</div>
    }

    if (tabsError) {
      return <div className={styles.emptyCommands}>{tabsError}</div>
    }

    if (!items.length) {
      return <div className={styles.emptyCommands}>暂无题卡</div>
    }

    return (
      <div className={styles.practiceGrid}>
        {items.map((item) => (
          <article key={item.id} className={styles.practiceCard}>
            <div className={`${styles.practiceCover} ${styles[item.coverClassName]}`}>
              <span className={styles.practiceCoverText}>{item.coverText}</span>
            </div>
            <div className={styles.practiceTitle}>{item.title}</div>
            <div className={styles.practiceMeta}>
              <span className={styles.practiceMetaItem}>
                {getContentTypeIcon(item.type)}
                <span>{item.type}</span>
              </span>
              <span className={styles.practiceMetaItem}>
                <EyeOutlined />
                <span>{item.views}</span>
              </span>
              <span className={styles.practiceMetaItem}>
                <NodeIndexOutlined />
                <span>{item.uses}</span>
              </span>
            </div>
          </article>
        ))}
      </div>
    )
  }

  const renderPromptCards = (items: PromptItem[], emptyText = DEFAULT_EMPTY_PROMPT_TEXT) => {
    if (tabsLoading) {
      return <div className={styles.emptyCommands}>内容加载中...</div>
    }

    if (tabsError) {
      return <div className={styles.emptyCommands}>{tabsError}</div>
    }

    if (!items.length) {
      return <div className={styles.emptyCommands}>{emptyText}</div>
    }

    return (
      <div className={styles.promptGrid}>
        {items.map((item) => (
          <article key={item.id} className={styles.promptCard}>
            <div className={styles.promptTitle}>
              <span>{item.icon}</span>
              <span>{item.title}</span>
            </div>
            <p className={styles.promptSummary}>{item.summary}</p>
          </article>
        ))}
      </div>
    )
  }

  const tabItems = homeTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    children:
      tab.contentType === 'practice-cards'
        ? renderPracticeCards(tab.items)
        : renderPromptCards(tab.items, tab.emptyText),
  }))

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.panelContent}>
          <div className={styles.centerStage}>
            <div className={styles.topSection}>
              <div className={styles.hero}>
                <Avatar size={92} src={<img src={homeAvatar} alt="张容悟头像" />} className={styles.heroAvatar} />
                <h1 className={styles.greeting}>Hi ～，有什么可以帮你的？</h1>
              </div>

              <div ref={composerRef} className={styles.composerWrap}>
                <div className={styles.inputWrap}>
                  <div className={styles.attachTriggerWrap}>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.attachBtn} ${menuOpen ? styles.attachBtnActive : ''}`}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      onClick={() => setMenuOpen((value) => !value)}
                    >
                      {menuOpen ? <CloseOutlined /> : <PlusOutlined />}
                    </button>
                    {!menuOpen ? <div className={styles.attachTooltip}>上传附件/技能等</div> : null}
                  </div>
                  <Input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onPressEnter={handleSend}
                    style={{ flex: 1, border: 'none', boxShadow: 'none', background: 'transparent', fontSize: 14 }}
                    variant="borderless"
                    placeholder="@特定群组，总结群聊信息"
                  />
                  <span className={styles.tabHint}>Tab</span>
                  <div className={styles.inputActions}>
                    <button type="button" className={styles.iconBtn}>
                      <AudioOutlined />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.sendBtn} ${!prompt.trim() ? styles.sendBtnDisabled : ''}`}
                      onClick={handleSend}
                      disabled={!prompt.trim()}
                    >
                      <ArrowUpOutlined />
                    </button>
                  </div>
                </div>
                <div className={`${styles.attachMenu} ${menuOpen ? styles.attachMenuOpen : ''}`} role="menu">
                  {ATTACHMENT_ACTIONS.map((action) =>
                    action.key === 'tool' ? (
                      <button
                        key={action.key}
                        type="button"
                        className={`${styles.attachMenuItem} ${toolMenuOpen ? styles.attachMenuItemActive : ''}`}
                        onMouseEnter={() => {
                          setToolMenuOpen(true)
                          setSkillMenuOpen(false)
                        }}
                      >
                        <span className={styles.attachMenuMain}>
                          <span className={styles.attachMenuIcon}>{action.icon}</span>
                          <span>{action.label}</span>
                        </span>
                        <RightOutlined className={styles.attachMenuArrow} />
                      </button>
                    ) : action.key === 'skill' ? (
                      <button
                        key={action.key}
                        type="button"
                        className={`${styles.attachMenuItem} ${skillMenuOpen ? styles.attachMenuItemActive : ''}`}
                        onMouseEnter={() => {
                          setSkillMenuOpen(true)
                          setToolMenuOpen(false)
                        }}
                      >
                        <span className={styles.attachMenuMain}>
                          <span className={styles.attachMenuIcon}>{action.icon}</span>
                          <span>{action.label}</span>
                        </span>
                        <RightOutlined className={styles.attachMenuArrow} />
                      </button>
                    ) : (
                      <button
                        key={action.key}
                        type="button"
                        className={styles.attachMenuItem}
                        onMouseEnter={() => {
                          setToolMenuOpen(false)
                          setSkillMenuOpen(false)
                        }}
                      >
                        <span className={styles.attachMenuMain}>
                          <span className={styles.attachMenuIcon}>{action.icon}</span>
                          <span>{action.label}</span>
                        </span>
                        {action.hasArrow ? <RightOutlined className={styles.attachMenuArrow} /> : null}
                      </button>
                    ),
                  )}
                </div>

                <div className={`${styles.skillSubmenu} ${skillMenuOpen ? styles.skillSubmenuOpen : ''}`}>
                  <div className={styles.skillSubmenuHeader}>
                    <span>技能</span>
                  </div>
                  <div className={styles.skillSearchBox}>
                    <SearchOutlined className={styles.skillSearchIcon} />
                    <input
                      type="text"
                      className={styles.skillSearchInput}
                      placeholder="搜索技能"
                      value={skillSearchQuery}
                      onChange={(e) => setSkillSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className={styles.skillList}>
                    {skillsLoading ? (
                      <div className={styles.skillLoading}>加载中...</div>
                    ) : filteredSkills.length === 0 ? (
                      <div className={styles.skillEmpty}>
                        {skillSearchQuery ? '未找到匹配的技能' : '暂无技能'}
                      </div>
                    ) : (
                      filteredSkills.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          className={styles.skillItem}
                          onClick={() => handleSelectSkill(skill)}
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
                  <button type="button" className={styles.skillManageButton} onClick={handleManageSkills}>
                    <span className={styles.attachMenuMain}>
                      <span className={styles.toolItemMain}>
                        <SettingOutlined />
                        <span>管理技能</span>
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <div className={styles.quickActions}>
                {QUICK_ACTIONS.map((action) => (
                  <div key={action.label} className={styles.quickTag}>
                    <span className={styles.quickTagIcon}>{action.icon}</span>
                    <span>{action.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.bottom}>
              <Tabs items={tabItems} />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
