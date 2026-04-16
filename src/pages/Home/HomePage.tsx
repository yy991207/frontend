import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Tabs, message } from 'antd'
import {
  BarChartOutlined,
  BookOutlined,
  EyeOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  SnippetsOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import homeTabsUrl from '../../../mock_json/home-tabs.json?url'
import chatConfigText from '../../../config.yaml?raw'
import { ChatComposer } from '../../components/common/ChatComposer'
import { AppPageShell, AppSurfacePanel } from '../../components/layout/AppPageShell'
import {
  createPendingUploadedFile,
  type UploadedFile,
  isAllowedFileType,
  ALLOWED_FILE_EXTENSIONS,
} from '../../services/ossUploadService'
import { uploadPendingFileToOssWithDocumentParse } from '../../services/agentFileUploadService'
import { resolveQuickActionToolType } from '../../services/chatService'
import {
  buildSkillInitialPrompt,
  extractSkillItemsFromResponse,
  type SkillApiResponse,
  type SkillItem,
} from '../../services/skillPromptService'
import {
  fetchCommands,
} from '../../services/commandsService'
import styles from './home.module.less'

const AILY_LOGO_URL = 'https://aily.feishu.cn/play/api/v1/files/static/offcial-logo15.png'
const HOME_USER_NAME = '~'

type HomeRouteState = {
  initialPrompt?: string
  toolType?: string | null
  skillName?: string
  skillDescription?: string
  template?: string
  uploadedFiles?: UploadedFile[]
  activateTabKey?: string
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
  const listPath = parsedConfig.list_user_skills_path
  const userId = parsedConfig.user_id
  const userIdParam = parsedConfig.skill_user_id_param

  if (!baseUrl || !managePath || !userId || !userIdParam) {
    throw new Error('config.yaml 缺少 url、view_user_skills_path、user_id 或 skill_user_id_param 配置')
  }

  const managePathWithUser = managePath.includes('{user_id}')
    ? managePath.replace('{user_id}', encodeURIComponent(userId))
    : managePath

  const listEndpoint = listPath
    ? buildAbsoluteUrl(baseUrl, listPath)
    : null

  return {
    manageEndpoint: buildAbsoluteUrl(baseUrl, managePathWithUser),
    listEndpoint,
    userId,
    userIdParam,
  }
}

const DEFAULT_EMPTY_PROMPT_TEXT = '暂无指令，请在对话运行后创建指令'

type PracticeItem = {
  id: number
  coverClassName?: string
  coverText?: string
  coverImageUrl?: string
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
  template?: string
  skill_name?: string | null
  attachments?: unknown[]
  coverImageUrl?: string
  type?: string
  practiceId?: string
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

type HeroStageLayout = {
  minHeight: number
  translateY: number
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

const HOME_TEMPLATE_ACTIONS = [
  { key: 'ppt', label: '生成 PPT', prompt: '帮我生成一份结构完整的 PPT 提纲', toolType: 'slides' },
  { key: 'creative-ppt', label: '生成创意 PPT', prompt: '帮我生成一份更有创意的 PPT 提纲', toolType: 'slides' },
  { key: 'doc', label: '写云文档', prompt: '帮我写一篇结构清晰的云文档内容', toolType: 'doc' },
  { key: 'report', label: '写报告', prompt: '帮我输出一份可直接汇报的分析报告', toolType: 'report' },
  { key: 'web', label: '搭建网页', prompt: '帮我设计一个可落地的网页首页', toolType: 'web' },
  { key: 'dashboard', label: '搭建仪表盘', prompt: '帮我设计一个数据仪表盘页面', toolType: 'dashboard' },
  { key: 'table', label: '创建多维表格', prompt: '帮我设计一个可直接使用的多维表格方案', toolType: 'table' },
  { key: 'image', label: '生成图片', prompt: '帮我生成一组风格统一的图片', toolType: 'image' },
  { key: 'excel', label: 'Excel', prompt: '帮我分析 Excel 数据并给出洞察', toolType: 'excel' },
  { key: 'chat', label: '对话模式', prompt: '', toolType: null },
  { key: 'more', label: '更多', prompt: '', toolType: null },
] as const

function getContentTypeIcon(type: string) {
  if (type === '图片') return <PictureOutlined />
  if (type === '云文档') return <BookOutlined />
  if (type === '报告') return <SnippetsOutlined />
  if (type === '仪表盘') return <BarChartOutlined />
  if (type === 'PPT') return <BarChartOutlined />
  return <BookOutlined />
}

function getHomeStageMetrics(viewportWidth: number) {
  if (viewportWidth <= 640) {
    return { shellOffset: 58, preferredGap: 16 }
  }

  if (viewportWidth <= 900) {
    return { shellOffset: 74, preferredGap: 20 }
  }

  return { shellOffset: 76, preferredGap: 24 }
}

export default function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const topSectionRef = useRef<HTMLDivElement | null>(null)
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const skillsFetchingRef = useRef(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isComposerMultiline, setIsComposerMultiline] = useState(false)
  const [preferredToolType, setPreferredToolType] = useState<string | null>(null)
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [selectedSkillDescription, setSelectedSkillDescription] = useState('')
  const [homeTabs, setHomeTabs] = useState<HomeTab[]>(DEFAULT_HOME_TABS)
  const [activeTabKey, setActiveTabKey] = useState<string | undefined>(undefined)
  const [tabsLoading, setTabsLoading] = useState(true)
  const [tabsError, setTabsError] = useState('')
  
  // 斜杠指令相关状态
  const [slashCommandOpen, setSlashCommandOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)
  const skipSlashSelectRef = useRef(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [heroStageLayout, setHeroStageLayout] = useState<HeroStageLayout>(() => {
    if (typeof window === 'undefined') {
      return {
        minHeight: 0,
        translateY: 0,
      }
    }

    return { minHeight: 0, translateY: 0 }
  })

  const clearSelectedSkill = () => {
    setPreferredToolType(null)
    setSelectedSkillName('')
    setSelectedSkillDescription('')
  }

  const handleUploadFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (!isAllowedFileType(file.name)) {
        message.warning(`不支持的文件类型: ${file.name}，仅支持 ${ALLOWED_FILE_EXTENSIONS.join('、')} 格式`)
        continue
      }

      const pendingFile = createPendingUploadedFile(file)
      setUploadedFiles((prev) => [...prev, pendingFile])

      const uploadedFile = await uploadPendingFileToOssWithDocumentParse(pendingFile, file, {
        onProgress: (progress) => {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === pendingFile.id ? { ...f, uploadProgress: progress } : f,
            ),
          )
        },
        onStatusChange: (nextFile) => {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.id === pendingFile.id ? nextFile : f)),
          )
        },
      })

      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === pendingFile.id ? uploadedFile : f)),
      )
    }

    event.target.value = ''
  }

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const skillApiConfig = useMemo(() => {
    try {
      return parseSkillApiConfig(chatConfigText)
    } catch {
      return null
    }
  }, [])

  const filteredSkills = useMemo(() => {
    if (!slashQuery) {
      return skills
    }

    const query = slashQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.skillName.toLowerCase().includes(query),
    )
  }, [skills, slashQuery])

  // 获取用户技能列表（我添加的 + 我创建的）
  const fetchSkills = useCallback(async (signal?: AbortSignal) => {
    if (!skillApiConfig) {
      setSkills([])
      return
    }

    setSkillsLoading(true)

    try {
      const fetchAdded = async (): Promise<SkillItem[]> => {
        const requestUrl = new URL(skillApiConfig.manageEndpoint)
        requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)
        const response = await fetch(requestUrl.toString(), { signal })
        if (!response.ok) throw new Error('技能接口请求失败')
        const data = (await response.json()) as SkillApiResponse
        if (!data.success) throw new Error(data.msg || '技能接口返回失败')
        return extractSkillItemsFromResponse(data)
      }

      const fetchCreated = async (): Promise<SkillItem[]> => {
        if (!skillApiConfig.listEndpoint) return []
        const requestUrl = new URL(skillApiConfig.listEndpoint)
        requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)
        const response = await fetch(requestUrl.toString(), { signal })
        if (!response.ok) throw new Error('我创建的技能接口请求失败')
        const data = (await response.json()) as SkillApiResponse
        if (!data.success) throw new Error(data.msg || '我创建的技能接口返回失败')
        return extractSkillItemsFromResponse(data)
      }

      const [addedSkills, createdSkills] = await Promise.all([fetchAdded(), fetchCreated()])
      const seen = new Set<string>()
      const merged: SkillItem[] = []
      for (const skill of [...addedSkills, ...createdSkills]) {
        if (!seen.has(skill.id)) {
          seen.add(skill.id)
          merged.push(skill)
        }
      }
      setSkills(merged)
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

  // 选择技能后先进入输入态，和技能管理页”使用”保持一致。
  const handleSelectSkill = (skill: SkillItem) => {
    // 首页加号选技能后先进入输入态，和”使用/我创建的”保持一致，等用户确认内容后再发送。
    setSelectedSkillName(skill.skillName || skill.id)
    setSelectedSkillDescription(skill.description)
    setPreferredToolType(skill.skillName || skill.id)
    skipSlashSelectRef.current = true
    setPrompt(buildSkillInitialPrompt(skill))
    requestAnimationFrame(() => { skipSlashSelectRef.current = false })
  }

  // 当斜杠指令浮层打开时，自动加载技能列表
  useEffect(() => {
    if (slashCommandOpen && skills.length === 0 && !skillsLoading && !skillsFetchingRef.current) {
      skillsFetchingRef.current = true
      void fetchSkills().finally(() => {
        skillsFetchingRef.current = false
      })
    }
  }, [slashCommandOpen, skills.length, skillsLoading, fetchSkills])

  useEffect(() => {
    const routeState = location.state as HomeRouteState

    if (routeState?.activateTabKey) {
      setActiveTabKey(routeState.activateTabKey)
      navigate(location.pathname, { replace: true, state: null })
      return
    }

    if (!routeState?.initialPrompt) {
      return
    }

    // 首页统一只保留输入框里的完整提示词，避免 badge 和 “基于 /skill ...” 重复显示。
    if (routeState.skillName) {
      setSelectedSkillName(routeState.skillName.trim())
      setSelectedSkillDescription(routeState.skillDescription?.trim() ?? '')
      setPrompt(routeState.initialPrompt.trim())
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

    // 首页"最佳实践"从 mock_json 读取，"推荐指令"和"我的指令"从 /api/v1/commands 获取
    const loadHomeTabs = async () => {
      try {
        const [mockResponse, commandsResponse] = await Promise.all([
          fetch(homeTabsUrl),
          fetchCommands().catch(() => null),
        ])

        if (disposed) {
          return
        }

        if (!mockResponse.ok) {
          throw new Error('mock json 请求失败')
        }

        const mockData = (await mockResponse.json()) as HomeTabsMockData
        const commandsResponseData = commandsResponse?.data
        const officialCommands = commandsResponseData?.official_commands ?? []
        const myCommands = commandsResponseData?.my_commands ?? []
        const apiBestPractices = commandsResponseData?.best_practices ?? []

        const recommendedTab = mockData.tabs.find((t) => t.key === 'recommended-prompts')
        const myPromptsTab = mockData.tabs.find((t) => t.key === 'my-prompts')
        const mockBestPracticeTab = mockData.tabs.find((t) => t.key === 'best-practice')

        // 从 mock 中构建封面图映射
        const coverImageMap = new Map<string, string>()
        const mockBestPracticeItems = mockBestPracticeTab?.items ?? []
        for (const mockItem of mockBestPracticeItems) {
          if ('title' in mockItem && 'coverImageUrl' in mockItem) {
            coverImageMap.set(mockItem.title, mockItem.coverImageUrl as string)
          }
        }

        // 映射 API 最佳实践数据 + 匹配封面图
        const contentTypes = new Map<string, string>()
        for (const mockItem of mockBestPracticeItems) {
          if ('title' in mockItem && 'type' in mockItem) {
            contentTypes.set(mockItem.title, mockItem.type as string)
          }
        }

        const bestPracticeItems: PromptItem[] = apiBestPractices.map((cmd, index) => ({
          id: index + 1,
          icon: cmd.icon ?? '📝',
          title: cmd.name,
          summary: cmd.description,
          template: cmd.template,
          skill_name: cmd.skill_name,
          attachments: cmd.attachments,
          coverImageUrl: coverImageMap.get(cmd.name),
          type: contentTypes.get(cmd.name) || '',
          practiceId: cmd.id,
        }))

        const mappedTabs: HomeTab[] = []

        if (mockBestPracticeTab) {
          mappedTabs.push({
            key: mockBestPracticeTab.key,
            label: mockBestPracticeTab.label,
            contentType: 'practice-cards',
            items: bestPracticeItems,
          })
        }

        if (recommendedTab) {
          mappedTabs.push({
            ...recommendedTab,
            items: officialCommands.map((cmd, index) => ({
              id: index + 1,
              icon: cmd.icon ?? '📝',
              title: cmd.name,
              summary: cmd.description,
              template: cmd.template,
              skill_name: cmd.skill_name,
              attachments: cmd.attachments,
            })),
          })
        }

        if (myPromptsTab) {
          mappedTabs.push({
            ...myPromptsTab,
            items: myCommands.map((cmd, index) => ({
              id: index + 1,
              icon: cmd.icon ?? '📝',
              title: cmd.name,
              summary: cmd.description,
              template: cmd.template,
              skill_name: cmd.skill_name,
              attachments: cmd.attachments,
            })),
          })
        }

        setHomeTabs(mappedTabs)
        setTabsError('')
      } catch {
        if (disposed) {
          return
        }

        setHomeTabs(DEFAULT_HOME_TABS)
        setTabsError('首页内容加载失败，请检查数据源')
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

  useLayoutEffect(() => {
    let frameId = 0
    const topSectionElement = topSectionRef.current

    if (!topSectionElement) {
      return
    }

    // 简化布局：让 heroStage 高度紧贴内容 + 小间距，不再有居中位移。
    const measureHeroStageLayout = () => {
      const currentTopSection = topSectionRef.current

      if (!currentTopSection) {
        return
      }

      const topSectionRect = currentTopSection.getBoundingClientRect()
      const { preferredGap } = getHomeStageMetrics(window.innerWidth)
      const nextMinHeight = Math.ceil(topSectionRect.height) + preferredGap

      setHeroStageLayout((currentValue) =>
        currentValue.minHeight === nextMinHeight
          ? currentValue
          : {
              minHeight: nextMinHeight,
              translateY: 0,
            },
      )
    }

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(measureHeroStageLayout)
    }

    scheduleMeasure()

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(topSectionElement)
    window.addEventListener('resize', scheduleMeasure)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [])

  const handleSend = () => {
    const value = prompt.trim()
    if (!value) return

    // prompt 已由 handleSelectSkill 完成拼接，直接使用
    const outgoingPrompt = value

    const completedFiles = uploadedFiles.filter((f) => f.status === 'completed')
    const pendingFiles = [...completedFiles]

    setPrompt('')
    clearSelectedSkill()
    setUploadedFiles([])
    console.log('[DEBUG HomePage] selectedSkillName:', selectedSkillName, 'preferredToolType:', preferredToolType, 'outgoingToolType:', preferredToolType || resolveQuickActionToolType(value))
    navigate('/chat', {
      state: {
        initialPrompt: outgoingPrompt,
        toolType: preferredToolType || resolveQuickActionToolType(value),
        uploadedFiles: pendingFiles,
      },
    })
  }

  const handleQuickActionClick = (action: (typeof HOME_TEMPLATE_ACTIONS)[number]) => {
    if (action.key === 'more') {
      navigate('/discover')
      return
    }

    if (action.key === 'chat') {
      clearSelectedSkill()
      setPreferredToolType(null)
      setPrompt('')
      return
    }

    // 首页模板入口只负责帮用户快速填充意图，不直接发送，避免误触后马上跳到会话页。
    clearSelectedSkill()
    setPreferredToolType(action.toolType)
    setPrompt(action.prompt)
  }

  // 统一的指令点击处理：基于 skill_name + template 逻辑
  const handleCommandClick = useCallback((item: PromptItem) => {
    const skillName = item.skill_name
    const template = item.template || ''
    const attachments = item.attachments || []

    // 基于 skill_name + template 逻辑
    if (skillName && template) {
      setSelectedSkillName(skillName)
      setPreferredToolType(skillName)
      setPrompt(`/${skillName} ${template}`)
    } else if (template) {
      setPrompt(template)
    }

    // 处理附件：将 API 附件转换为 UploadedFile 格式
    if (attachments.length > 0) {
      const mappedFiles: UploadedFile[] = attachments
        .filter((a): a is { resource_id: string; file_name: string; url: string } =>
          !!a && typeof a === 'object' && 'file_name' in a && 'url' in a,
        )
        .map((a, i) => ({
          id: `attachment-${a.resource_id || i}`,
          name: a.file_name,
          url: a.url,
          status: 'completed' as const,
          size: 0,
          progress: 100,
        }))
      setUploadedFiles(mappedFiles)
    }
  }, [])

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
            <div className={styles.practiceCover}>
              {item.coverImageUrl ? (
                <img src={item.coverImageUrl} alt={item.title} className={styles.practiceCoverImage} />
              ) : (
                <div className={`${styles.practiceFallbackCover} ${item.coverClassName ? styles[item.coverClassName] : ''}`}>
                  <span className={styles.practiceCoverText}>{item.coverText}</span>
                </div>
              )}
              <div className={styles.practiceCoverActions}>
                <button type="button" className={styles.practiceActionButton}>查看</button>
                <button type="button" className={styles.practiceActionPrimary}>做同款</button>
              </div>
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

  const renderPromptCards = (items: PromptItem[], emptyText = DEFAULT_EMPTY_PROMPT_TEXT, onCardClick?: (item: PromptItem) => void) => {
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
          <article
            key={item.id}
            className={styles.promptCard}
            onClick={() => {
              if (item.template) {
                onCardClick?.(item)
              }
            }}
          >
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

  const renderPracticePromptCards = (items: PromptItem[], onCardClick?: (item: PromptItem) => void, onViewConversation?: (practiceId: string) => void) => {
    if (tabsLoading) {
      return <div className={styles.emptyCommands}>内容加载中...</div>
    }

    if (tabsError) {
      return <div className={styles.emptyCommands}>{tabsError}</div>
    }

    if (!items.length) {
      return <div className={styles.emptyCommands}>暂无实践</div>
    }

    return (
      <div className={styles.practiceGrid}>
        {items.map((item) => (
          <article
            key={item.id}
            className={styles.practiceCard}
            onClick={() => {
              if (item.template) {
                onCardClick?.(item)
              }
            }}
          >
            <div className={styles.practiceCover}>
              {item.coverImageUrl ? (
                <img src={item.coverImageUrl} alt={item.title} className={styles.practiceCoverImage} />
              ) : (
                <div className={styles.practiceFallbackCover}>
                  <span className={styles.practiceCoverText}>{item.title.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className={styles.practiceCoverActions}>
                {item.practiceId && onViewConversation ? (
                  <button
                    type="button"
                    className={styles.practiceActionButton}
                    onClick={(e) => { e.stopPropagation(); onViewConversation(item.practiceId!) }}
                  >
                    查看对话
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.practiceActionPrimary}
                  onClick={(e) => { e.stopPropagation(); onCardClick?.(item) }}
                >
                  做同款
                </button>
              </div>
            </div>
            <div className={styles.practiceTitle}>{item.title}</div>
            {item.type ? (
              <div className={styles.practiceMeta}>
                <span className={styles.practiceMetaItem}>
                  {getContentTypeIcon(item.type)}
                  <span>{item.type}</span>
                </span>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    )
  }

  const tabItems = homeTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    children:
      tab.key === 'best-practice'
        ? renderPracticePromptCards(tab.items as PromptItem[], handleCommandClick, (practiceId) => navigate(`/practice/${practiceId}`))
        : tab.contentType === 'prompt-cards'
          ? renderPromptCards(tab.items as PromptItem[], tab.emptyText, handleCommandClick)
          : renderPracticeCards(tab.items as PracticeItem[]),
  }))

  return (
    <AppPageShell>
      <AppSurfacePanel className={styles.panel}>
        <div className={styles.panelContent}>
          <div className={styles.centerStage}>
            <div
              className={styles.heroStage}
              style={{
                minHeight: `${heroStageLayout.minHeight}px`,
              }}
            >
              <div
                ref={topSectionRef}
                className={styles.topSection}
              >
                <div className={styles.hero}>
                  <Avatar size={68} src={<img src={AILY_LOGO_URL} alt="飞书 aily logo" />} className={styles.heroAvatar} />
                  <h1 className={styles.greeting}>Hi {HOME_USER_NAME} 有什么可以帮你的？</h1>
                </div>

                <div
                  className={`${styles.composerWrap} ${slashCommandOpen ? styles.composerWrapRaised : ''}`}
                  data-testid="home-composer-wrap"
                  data-layer-state={slashCommandOpen ? 'raised' : 'normal'}
                >
                  <ChatComposer
                    testId="home-composer"
                    layout={isComposerMultiline ? 'stacked' : 'inline'}
                    variant="agentConversation"
                    skillPanelPosition="below"
                    value={prompt}
                    onChange={(value) => {
                      setPrompt(value)

                      // 检测斜杠指令触发
                      if (skipSlashSelectRef.current) return
                      if (value === '/' && !slashCommandOpen) {
                        setSlashCommandOpen(true)
                        setSlashQuery('')
                        setSelectedSkillIndex(0)
                      } else if (!value.startsWith('/')) {
                        setSlashCommandOpen(false)
                      } else if (value.startsWith('/')) {
                        setSlashQuery(value.slice(1))
                      }

                      // 用户手动编辑输入框，删除已选技能的 /skillName 标记时，清空技能状态
                      if (selectedSkillName) {
                        const skillDisplayName = `/${selectedSkillName.replace(/^\/+/, '')}`
                        if (!value.includes(skillDisplayName)) {
                          clearSelectedSkill()
                        }
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                        return
                      }

                      // 斜杠指令浮层打开时的键盘处理
                      if (slashCommandOpen) {
                        switch (event.key) {
                          case 'ArrowDown':
                            event.preventDefault()
                            setSelectedSkillIndex((prev) =>
                              prev < filteredSkills.length - 1 ? prev + 1 : prev
                            )
                            return
                          case 'ArrowUp':
                            event.preventDefault()
                            setSelectedSkillIndex((prev) => (prev > 0 ? prev - 1 : 0))
                            return
                          case 'Enter':
                            event.preventDefault()
                            event.stopPropagation()
                            if (filteredSkills[selectedSkillIndex]) {
                              handleSelectSkill(filteredSkills[selectedSkillIndex])
                              setSlashCommandOpen(false)
                              setSlashQuery('')
                            }
                            return
                          case 'Escape':
                            event.preventDefault()
                            setSlashCommandOpen(false)
                            return
                        }
                      }

                      if (event.key === 'Backspace' && !prompt.trim() && selectedSkillName) {
                        event.preventDefault()
                        clearSelectedSkill()
                      }

                      // 支持 Enter 发送，Shift+Enter 换行
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        handleSend()
                      }
                    }}
                    onSend={handleSend}
                    onMultilineChange={setIsComposerMultiline}
                    placeholder="输入你的想法或输入'/'选择想要使用技能"
                    selectedSkillName={selectedSkillName}
                    selectedSkillDescription={selectedSkillDescription}
                    slashCommandOpen={slashCommandOpen}
                    slashQuery={slashQuery}
                    onSlashQueryChange={setSlashQuery}
                    skills={skills}
                    filteredSkills={filteredSkills}
                    skillsLoading={skillsLoading}
                    loadSkills={fetchSkills}
                    selectedSkillIndex={selectedSkillIndex}
                    onSelectSkill={(skill) => {
                      handleSelectSkill(skill)
                      setSlashCommandOpen(false)
                      setSlashQuery('')
                    }}
                    onCloseSlashCommand={() => setSlashCommandOpen(false)}
                    onManageSkills={handleManageSkills}
                    uploadedFiles={uploadedFiles}
                    onRemoveFile={handleRemoveFile}
                    fileInputRef={fileInputRef}
                    onFileChange={handleFileChange}
                    onUploadFile={handleUploadFile}
                    webSearchEnabled={webSearchEnabled}
                    knowledgeEnabled={knowledgeEnabled}
                    onToggleWebSearch={() => setWebSearchEnabled((value) => !value)}
                    onToggleKnowledge={() => setKnowledgeEnabled((value) => !value)}
                    sendDisabled={!prompt.trim()}
                  />
                </div>

                <div className={styles.quickActions} style={{ display: 'none' }}>
                  {HOME_TEMPLATE_ACTIONS.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className={styles.quickTag}
                      onClick={() => handleQuickActionClick(action)}
                    >
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.bottom}>
              <Tabs items={tabItems} activeKey={activeTabKey} onChange={setActiveTabKey} />
            </div>
          </div>
        </div>
      </AppSurfacePanel>
    </AppPageShell>
  )
}
