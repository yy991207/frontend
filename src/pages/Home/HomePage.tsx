import { useCallback, useEffect, useMemo, useState } from 'react'
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
  FileExcelOutlined,
  FileTextOutlined,
  GlobalOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  SnippetsOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import homeTabsUrl from '../../../mock_json/home-tabs.json?url'
import homeAvatar from '../../assets/home-avatar.png'
import chatConfigText from '../../../config.yaml?raw'
import { AttachmentMenu } from '../../components/common/AttachmentMenu'
import { resolveQuickActionToolType } from '../../services/chatService'
import {
  buildSkillDisplayName,
  buildSkillInitialPrompt,
  extractSkillItemsFromResponse,
  type SkillApiResponse,
  type SkillItem,
} from '../../services/skillPromptService'
import styles from './home.module.less'

type HomeRouteState = {
  initialPrompt?: string
  toolType?: string | null
  skillName?: string
  skillDescription?: string
  template?: string
} | null

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
  const location = useLocation()
  const navigate = useNavigate()
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [preferredToolType, setPreferredToolType] = useState<string | null>(null)
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [selectedSkillDescription, setSelectedSkillDescription] = useState('')
  const [homeTabs, setHomeTabs] = useState<HomeTab[]>(DEFAULT_HOME_TABS)
  const [tabsLoading, setTabsLoading] = useState(true)
  const [tabsError, setTabsError] = useState('')

  const clearSelectedSkill = () => {
    setPreferredToolType(null)
    setSelectedSkillName('')
    setSelectedSkillDescription('')
  }

  const skillApiConfig = useMemo(() => {
    try {
      return parseSkillApiConfig(chatConfigText)
    } catch {
      return null
    }
  }, [])

  // 获取用户技能列表
  const fetchSkills = useCallback(async (signal?: AbortSignal) => {
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
  }, [skillApiConfig])

  // 跳转到技能管理页面
  const handleManageSkills = () => {
    navigate('/skills', {
      state: {
        mode: 'manage',
      },
    })
  }

  // 选择技能后先进入输入态，和技能管理页“使用”保持一致。
  const handleSelectSkill = (skill: SkillItem) => {
    // 首页加号选技能后先进入输入态，和“使用/我创建的”保持一致，等用户确认内容后再发送。
    setSelectedSkillName(skill.skillName || skill.id)
    setSelectedSkillDescription(skill.description)
    setPreferredToolType(skill.skillName || skill.id)
    setPrompt(skill.template)
  }

  useEffect(() => {
    const routeState = location.state as HomeRouteState

    if (!routeState?.initialPrompt) {
      return
    }

    // 技能页回到首页后，把技能标签和模板拆开渲染，输入框里只保留可编辑部分。
    if (routeState.skillName) {
      setSelectedSkillName(routeState.skillName.trim())
      setSelectedSkillDescription(routeState.skillDescription?.trim() ?? '')
      setPrompt(routeState.template?.trim() ?? '')
    } else {
      setSelectedSkillName('')
      setSelectedSkillDescription('')
      setPrompt(routeState.initialPrompt.trim())
    }
    setPreferredToolType(routeState.toolType ?? null)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

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

    const outgoingPrompt = selectedSkillName
      ? buildSkillInitialPrompt({
          skillName: selectedSkillName,
          template: value,
          title: selectedSkillName,
        })
      : value

    setPrompt('')
    clearSelectedSkill()
    navigate('/chat', {
      state: {
        initialPrompt: outgoingPrompt,
        toolType: preferredToolType || resolveQuickActionToolType(value),
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

              <div className={styles.composerWrap}>
                <div className={styles.inputWrap}>
                  <AttachmentMenu
                    placement="bottom"
                    skills={skills}
                    skillsLoading={skillsLoading}
                    loadSkills={fetchSkills}
                    onSelectSkill={handleSelectSkill}
                    onManageSkills={handleManageSkills}
                    showTools
                    webSearchEnabled={webSearchEnabled}
                    knowledgeEnabled={knowledgeEnabled}
                    onToggleWebSearch={() => setWebSearchEnabled((value) => !value)}
                    onToggleKnowledge={() => setKnowledgeEnabled((value) => !value)}
                  />
                  {selectedSkillName ? <span className={styles.skillPrefix}>基于</span> : null}
                  {selectedSkillName ? (
                    <span className={styles.skillTagWrap}>
                      <span className={styles.skillNameTag}>{buildSkillDisplayName(selectedSkillName)}</span>
                      <button
                        type="button"
                        className={styles.skillRemoveButton}
                        aria-label="移除已选技能"
                        onClick={clearSelectedSkill}
                      >
                        <CloseOutlined />
                      </button>
                      {selectedSkillDescription ? (
                        <span className={styles.skillDescriptionTooltip}>{selectedSkillDescription}</span>
                      ) : null}
                    </span>
                  ) : null}
                  <Input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                        return
                      }

                      if (event.key === 'Backspace' && !prompt.trim() && selectedSkillName) {
                        event.preventDefault()
                        clearSelectedSkill()
                      }
                    }}
                    onPressEnter={handleSend}
                    style={{ flex: 1, minWidth: 0, border: 'none', boxShadow: 'none', background: 'transparent', fontSize: 14 }}
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
