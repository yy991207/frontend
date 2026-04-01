import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  DownOutlined,
  EllipsisOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  ShareAltOutlined,
  StarFilled,
  SwapOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import skillConfigText from '../../../config.yaml?raw'
import homeAvatar from '../../assets/home-avatar.png'
import styles from './skills.module.less'

type SkillsMode = 'discover' | 'manage'
type ManageTab = 'added' | 'created'

type SkillApiConfig = {
  endpoint: string
  userId: string
  userIdParam: string
}

type SkillApiItem = {
  name: string
  chinese_name: string
  description: string
}

type SkillApiResponse = {
  success: boolean
  code: string
  msg: string
  data?: {
    skills?: SkillApiItem[]
    total?: number
  }
}

type ManageSkillCard = {
  id: string
  title: string
  description: string
  toneClassName: 'manageCardGreen' | 'manageCardAmber'
  icon: React.ReactNode
}

const CREATE_OPTIONS = [
  {
    key: 'chat',
    title: '使用对话创建',
    description: '通过对话构建个人使用的技能',
    icon: <ThunderboltOutlined />,
  },
  {
    key: 'upload',
    title: '上传技能',
    description: '上传 .zip、.skill 文件或文件夹',
    icon: <UploadOutlined />,
  },
]

const FEATURED_SKILLS = [
  {
    id: 1,
    title: '营销文案创作',
    description: '用于为任意页面撰写、改写或优化营销文案，包括首页、落地页、定价页、功能页...',
    toneClassName: 'skillCardAmber',
    tags: ['营销', '写作'],
    count: '2.1k 次添加',
    icon: <StarFilled />,
  },
  {
    id: 2,
    title: '内容选题规划',
    description: '用于规划内容策略、决定创作方向或确定选题。当用户提及以下内容时适用：内容策...',
    toneClassName: 'skillCardIndigo',
    tags: ['营销', '规划'],
    count: '2.4k 次添加',
    icon: <ShareAltOutlined />,
  },
  {
    id: 3,
    title: '产品路线图设计',
    description: '使用 RICE、MoSCoW 等优先级框架以及依赖关系映射来制定产品路线图，并支持路...',
    toneClassName: 'skillCardGreen',
    tags: ['产品', '规划'],
    count: '1.7k 次添加',
    icon: <SwapOutlined />,
  },
]

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

function parseSkillApiConfig(rawText: string): SkillApiConfig {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const skillPath = parsedConfig.skill_path
  const userId = parsedConfig.user_id
  const userIdParam = parsedConfig.skill_user_id_param

  if (!baseUrl || !skillPath || !userId || !userIdParam) {
    throw new Error('config.yaml 缺少 url、skill_path、user_id 或 skill_user_id_param 配置')
  }

  return {
    endpoint: new URL(skillPath, baseUrl).toString(),
    userId,
    userIdParam,
  }
}

function getManageCardPresentation(index: number) {
  if (index % 3 === 0) {
    return {
      toneClassName: 'manageCardGreen' as const,
      icon: <CheckCircleFilled />,
    }
  }

  if (index % 3 === 1) {
    return {
      toneClassName: 'manageCardAmber' as const,
      icon: <ShareAltOutlined />,
    }
  }

  return {
    toneClassName: 'manageCardGreen' as const,
    icon: <ThunderboltOutlined />,
  }
}

export default function SkillsPage() {
  const [mode, setMode] = useState<SkillsMode>('discover')
  const [createOpen, setCreateOpen] = useState(false)
  const [manageTab, setManageTab] = useState<ManageTab>('added')
  const [addedSkills, setAddedSkills] = useState<SkillApiItem[]>([])
  const [addedSkillsLoading, setAddedSkillsLoading] = useState(false)
  const [addedSkillsError, setAddedSkillsError] = useState('')
  const createWrapRef = useRef<HTMLDivElement | null>(null)
  const skillApiConfig = useMemo(() => {
    try {
      // 接口地址和 userId 统一从 config.yaml 读取，避免页面里写死环境配置。
      return parseSkillApiConfig(skillConfigText)
    } catch {
      return null
    }
  }, [])

  // 创建菜单点外部自动关闭，避免弹层停留在页面上。
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!createWrapRef.current?.contains(event.target as Node)) {
        setCreateOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'manage' || manageTab !== 'added') {
      return
    }

    if (!skillApiConfig) {
      setAddedSkills([])
      setAddedSkillsError('技能配置读取失败，请检查 config.yaml')
      setAddedSkillsLoading(false)
      return
    }

    const controller = new AbortController()

    const loadAddedSkills = async () => {
      setAddedSkillsLoading(true)
      setAddedSkillsError('')

      try {
        // 这里直接按配置组装请求地址，保证地址和用户参数都来自 config.yaml。
        const requestUrl = new URL(skillApiConfig.endpoint)
        requestUrl.searchParams.set(skillApiConfig.userIdParam, skillApiConfig.userId)

        const response = await fetch(requestUrl.toString(), {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('技能接口请求失败')
        }

        const data = (await response.json()) as SkillApiResponse

        if (!data.success) {
          throw new Error(data.msg || '技能接口返回失败')
        }

        const nextSkills = Array.isArray(data.data?.skills) ? data.data.skills : []

        setAddedSkills(nextSkills)
        setAddedSkillsError('')
      } catch {
        if (controller.signal.aborted) {
          return
        }

        setAddedSkills([])
        setAddedSkillsError('技能加载失败，请检查接口配置或服务状态')
      } finally {
        if (!controller.signal.aborted) {
          setAddedSkillsLoading(false)
        }
      }
    }

    loadAddedSkills()

    return () => {
      controller.abort()
    }
  }, [mode, manageTab, skillApiConfig])

  const manageList = useMemo<ManageSkillCard[]>(() => {
    if (manageTab !== 'added') {
      return []
    }

    return addedSkills.map((item, index) => {
      const presentation = getManageCardPresentation(index)

      return {
        id: item.name,
        title: item.chinese_name,
        description: item.description,
        toneClassName: presentation.toneClassName,
        icon: presentation.icon,
      }
    })
  }, [addedSkills, manageTab])

  const manageEmptyText = useMemo(() => {
    if (manageTab === 'created') {
      return '还没有创建任何技能'
    }

    if (addedSkillsError) {
      return addedSkillsError
    }

    return '还没有添加任何技能'
  }, [addedSkillsError, manageTab])

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        {mode === 'discover' ? (
          <div className={styles.discoverPage}>
            <div className={styles.heroBlock}>
              <div className={styles.heroActions}>
                <div ref={createWrapRef} className={styles.createWrap}>
                  <button
                    type="button"
                    className={styles.createButton}
                    aria-expanded={createOpen}
                    aria-haspopup="menu"
                    onClick={() => setCreateOpen((value) => !value)}
                  >
                    <span className={styles.createButtonMain}>
                      <PlusOutlined />
                      <span>创建</span>
                    </span>
                    <DownOutlined className={`${styles.createArrow} ${createOpen ? styles.createArrowOpen : ''}`} />
                  </button>
                  <div className={`${styles.createMenu} ${createOpen ? styles.createMenuOpen : ''}`} role="menu">
                    {CREATE_OPTIONS.map((option) => (
                      <button key={option.key} type="button" className={styles.createMenuItem}>
                        <span className={styles.createMenuIcon}>{option.icon}</span>
                        <span className={styles.createMenuText}>
                          <span className={styles.createMenuTitle}>{option.title}</span>
                          <span className={styles.createMenuDesc}>{option.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button type="button" className={styles.manageButton} onClick={() => setMode('manage')}>
                  <SettingOutlined />
                  <span>管理技能</span>
                </button>
              </div>

              <div className={styles.heroHeading}>
                <span className={styles.heroWave}>👋</span>
                <h1 className={styles.heroTitle}>Hi～ 发现并管理你的技能</h1>
              </div>

              <label className={styles.searchBox}>
                <SearchOutlined className={styles.searchIcon} />
                <input className={styles.searchInput} placeholder="搜索技能名称、描述或标签" />
              </label>
            </div>

            <div className={styles.bannerRow}>
              <article className={`${styles.bannerCard} ${styles.bannerCardDark}`}>
                <div className={styles.bannerContent}>
                  <h2 className={styles.bannerTitle}>办公版龙虾🦞 必备技能包</h2>
                  <p className={styles.bannerDesc}>与果仁生态打通，解锁 OpenClaw 办公版龙虾执行力，自动搞定琐碎事务</p>
                  <button type="button" className={styles.bannerLink}>
                    查看技能包
                  </button>
                </div>
                <div className={styles.bannerArtworkDark}>
                  <span className={styles.floatingChip}>26</span>
                  <span className={`${styles.floatingDot} ${styles.dotBlue}`} />
                  <span className={`${styles.floatingDot} ${styles.dotCyan}`} />
                  <div className={styles.lobsterBody} />
                  <div className={styles.lobsterEyeLeft} />
                  <div className={styles.lobsterEyeRight} />
                  <div className={styles.lobsterClaw} />
                </div>
              </article>

              <article className={`${styles.bannerCard} ${styles.bannerCardLight}`}>
                <div className={styles.bannerContent}>
                  <h2 className={styles.bannerTitleLight}>「技能」挑战赛 只等你来！</h2>
                  <p className={styles.bannerDescLight}>参与大赛投稿和实践分享，有机会获得安克 AI 录音豆和京东京卡的大奖！</p>
                  <button type="button" className={styles.bannerLinkLight}>
                    立即参赛
                  </button>
                </div>
                <div className={styles.bannerArtworkLight}>
                  <span className={styles.ribbon} />
                  <div className={styles.deskBoard}>
                    <img src={homeAvatar} alt="技能挑战赛" className={styles.bannerAvatar} />
                    <div className={styles.boardCard}>
                      <span>早上好～ 今天的</span>
                      <strong>汇报 PPT</strong>
                      <span>已经完成啦！</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionTitleWrap}>
                  <StarFilled className={styles.sectionIcon} />
                  <h2 className={styles.sectionTitle}>官方精选</h2>
                </div>
                <button type="button" className={styles.sectionAction}>
                  <SwapOutlined />
                  <span>换一换</span>
                </button>
              </div>

              <div className={styles.featuredGrid}>
                {FEATURED_SKILLS.map((item) => (
                  <article key={item.id} className={styles.featuredCard}>
                    <div className={`${styles.featuredBadge} ${styles[item.toneClassName]}`}>{item.icon}</div>
                    <h3 className={styles.featuredTitle}>{item.title}</h3>
                    <p className={styles.featuredDesc}>{item.description}</p>
                    <div className={styles.featuredMeta}>
                      <div className={styles.featuredTags}>
                        {item.tags.map((tag) => (
                          <span key={tag} className={styles.featuredTag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className={styles.featuredCount}>{item.count}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className={styles.managePage}>
            <header className={styles.manageHeader}>
              <button type="button" className={styles.backButton} onClick={() => setMode('discover')}>
                <ArrowLeftOutlined />
                <span>管理技能</span>
              </button>

              <div className={styles.manageTools}>
                <label className={styles.manageSearchBox}>
                  <SearchOutlined className={styles.searchIcon} />
                  <input className={styles.searchInput} placeholder="搜索" />
                </label>

                <div ref={createWrapRef} className={styles.createWrap}>
                  <button
                    type="button"
                    className={styles.createButton}
                    aria-expanded={createOpen}
                    aria-haspopup="menu"
                    onClick={() => setCreateOpen((value) => !value)}
                  >
                    <span className={styles.createButtonMain}>
                      <PlusOutlined />
                      <span>创建</span>
                    </span>
                    <DownOutlined className={`${styles.createArrow} ${createOpen ? styles.createArrowOpen : ''}`} />
                  </button>
                  <div className={`${styles.createMenu} ${createOpen ? styles.createMenuOpen : ''}`} role="menu">
                    {CREATE_OPTIONS.map((option) => (
                      <button key={option.key} type="button" className={styles.createMenuItem}>
                        <span className={styles.createMenuIcon}>{option.icon}</span>
                        <span className={styles.createMenuText}>
                          <span className={styles.createMenuTitle}>{option.title}</span>
                          <span className={styles.createMenuDesc}>{option.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            <div className={styles.manageTabs}>
              <button
                type="button"
                className={`${styles.manageTab} ${manageTab === 'added' ? styles.manageTabActive : ''}`}
                onClick={() => setManageTab('added')}
              >
                我添加的
              </button>
              <button
                type="button"
                className={`${styles.manageTab} ${manageTab === 'created' ? styles.manageTabActive : ''}`}
                onClick={() => setManageTab('created')}
              >
                我创建的
              </button>
            </div>

            {manageTab === 'added' && addedSkillsLoading ? (
              <div className={styles.manageStatus}>技能加载中...</div>
            ) : manageList.length > 0 ? (
              <div className={styles.manageGrid}>
                {manageList.map((item) => (
                  <article key={item.id} className={styles.manageCard}>
                    <div className={styles.manageCardHead}>
                      <span className={`${styles.manageCardIcon} ${styles[item.toneClassName]}`}>{item.icon}</span>
                      <button type="button" className={styles.moreButton} aria-label="更多操作">
                        <EllipsisOutlined />
                      </button>
                    </div>
                    <div className={styles.manageTitleRow}>
                      <h3 className={styles.manageCardTitle}>{item.title}</h3>
                    </div>
                    <p className={styles.manageCardDesc}>{item.description}</p>
                    <button type="button" className={styles.useButton}>
                      立即使用
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.manageEmpty}>
                <div className={styles.balloonWrap}>
                  <span className={styles.balloonHalo} />
                  <span className={styles.balloonMain} />
                  <span className={styles.balloonString} />
                </div>
                <p className={styles.emptyText}>{manageEmptyText}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
