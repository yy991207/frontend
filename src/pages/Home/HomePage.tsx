import { useEffect, useRef, useState } from 'react'
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
  SnippetsOutlined,
  TableOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import homeTabsUrl from '../../../mock_json/home-tabs.json?url'
import homeAvatar from '../../assets/home-avatar.png'
import { resolveQuickActionToolType } from '../../services/chatService'
import styles from './home.module.less'

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
  const [prompt, setPrompt] = useState('')
  const [homeTabs, setHomeTabs] = useState<HomeTab[]>(DEFAULT_HOME_TABS)
  const [tabsLoading, setTabsLoading] = useState(true)
  const [tabsError, setTabsError] = useState('')
  const composerRef = useRef<HTMLDivElement | null>(null)

  // 输入区弹层点击外部自动关闭，避免菜单打开后一直停留在页面上。
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
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
                  {ATTACHMENT_ACTIONS.map((action) => (
                    <button key={action.key} type="button" className={styles.attachMenuItem}>
                      <span className={styles.attachMenuMain}>
                        <span className={styles.attachMenuIcon}>{action.icon}</span>
                        <span>{action.label}</span>
                      </span>
                      {action.hasArrow ? <RightOutlined className={styles.attachMenuArrow} /> : null}
                    </button>
                  ))}
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
