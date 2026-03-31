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
import homeAvatar from '../../assets/home-avatar.png'
import styles from './skills.module.less'

type SkillsMode = 'discover' | 'manage'
type ManageTab = 'added' | 'created'

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

const MANAGE_SKILLS = [
  {
    id: 1,
    title: '技能调试优化',
    description: '用于检查、测试或优化某个技能。包括：验证技能描述是否能被正确触发、优化描述表达、检查技能在目标环境中是否可用，以及根据特定...',
    toneClassName: 'manageCardGreen',
    icon: <CheckCircleFilled />,
  },
  {
    id: 2,
    title: '季度/年度业务汇报',
    description: '围绕指标达成、业务进展、问题与对策输出结构化业务汇报。',
    toneClassName: 'manageCardAmber',
    icon: <ShareAltOutlined />,
  },
  {
    id: 3,
    title: '商业计划书',
    description: '强调市场机会、产品与商业模式、竞争、团队、财务与风险，形成可评审 BP。',
    toneClassName: 'manageCardGreen',
    icon: <ShareAltOutlined />,
  },
  {
    id: 4,
    title: '企业调研报告',
    description: '基于官方与公开信息输出公司概况、业务结构、竞争位置、经营与风险的结构化研究。',
    toneClassName: 'manageCardAmber',
    icon: <ShareAltOutlined />,
  },
  {
    id: 5,
    title: '活动营销方案',
    description: '明确目标人群、核心卖点、传播节奏、渠道策略和风险预案，形成可执行活动方案。',
    toneClassName: 'manageCardGreen',
    icon: <ShareAltOutlined />,
  },
  {
    id: 6,
    title: '项目启动报告',
    description: '梳理目标、范围、里程碑、接口协同、分工和风险，形成可共享的启动说明。',
    toneClassName: 'manageCardAmber',
    icon: <ThunderboltOutlined />,
  },
]

export default function SkillsPage() {
  const [mode, setMode] = useState<SkillsMode>('discover')
  const [createOpen, setCreateOpen] = useState(false)
  const [manageTab, setManageTab] = useState<ManageTab>('added')
  const createWrapRef = useRef<HTMLDivElement | null>(null)

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

  const manageList = useMemo(() => (manageTab === 'added' ? MANAGE_SKILLS : []), [manageTab])

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

            {manageList.length > 0 ? (
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
                      <span className={styles.builtinTag}>内置</span>
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
                <p className={styles.emptyText}>还没有创建任何技能</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
