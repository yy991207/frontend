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
import homeAvatar from '../../assets/home-avatar.png'
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

const BEST_PRACTICE_ITEMS = [
  { id: 1, coverClassName: 'practiceCoverSketch', coverText: 'AlbertYang: 战略规划者 × 效率优化师', title: '个人工作画像生成', type: '图片', views: '2,826', uses: '55,656' },
  { id: 2, coverClassName: 'practiceCoverDocument', coverText: 'OpenAI 关停 Sora 及多模态生成市场分析报告', title: 'Sora关停及多模态市场分析', type: '云文档', views: '87', uses: '781' },
  { id: 3, coverClassName: 'practiceCoverOrange', coverText: 'AI INDUSTRY 洞察周报', title: 'AI 行业洞察周报', type: '报告', views: '1,393', uses: '11,062' },
  { id: 4, coverClassName: 'practiceCoverDashboard', coverText: '项目进度概览数据分析看板', title: '直播同款 | 总结多维表数据深洞察', type: '仪表盘', views: '775', uses: '2,867' },
  { id: 5, coverClassName: 'practiceCoverCoffee', coverText: 'Q1工作复盘与Q2规划汇报', title: 'Q1复盘&Q2规划｜季度汇报框架', type: 'PPT', views: '232', uses: '1,715' },
  { id: 6, coverClassName: 'practiceCoverWhitepaper', coverText: '白话讲解 OpenClaw', title: '白话讲解OpenClaw', type: '云文档', views: '1,958', uses: '10,816' },
  { id: 7, coverClassName: 'practiceCoverBlue', coverText: '团队AI工作方式升级方案', title: 'AI 提效指南｜团队工作方式升级方案', type: 'PPT', views: '176', uses: '693' },
  { id: 8, coverClassName: 'practiceCoverPurple', coverText: 'Booc 文创周边包装', title: '文创周边包装 / 品牌设计', type: '图片', views: '803', uses: '3,079' },
  { id: 9, coverClassName: 'practiceCoverAigc', coverText: 'The Evolution of AIGC', title: 'The Evolution of AIGC', type: 'PPT', views: '418', uses: '2,216' },
  { id: 10, coverClassName: 'practiceCoverNature', coverText: '自然 美学 有机设计', title: '自然 美学 有机设计', type: '图片', views: '1,084', uses: '6,241' },
  { id: 11, coverClassName: 'practiceCoverSpring', coverText: '春日奇遇记 2026', title: '春日奇遇记', type: '图片', views: '526', uses: '1,962' },
  { id: 12, coverClassName: 'practiceCoverDark', coverText: 'Harness Engineering', title: 'Harness Engineering: AI Agent 协作框架概览', type: '云文档', views: '1,302', uses: '8,442' },
]

const RECOMMENDED_PROMPTS = [
  { id: 1, icon: '📰', title: '每周人工智能新闻汇总', summary: '搜索汇总上周最有价值的 AI 行业新闻资讯，重点关注 Google、微软...' },
  { id: 2, icon: '👨‍💼', title: '企业员工每周工作总结', summary: '基于我的上周的飞书任务、飞书日程、飞书云文档、飞书妙记内容...' },
  { id: 3, icon: '📈', title: '电商行业的销售业绩可视化', summary: '基于我上传的文件，通过可视化方法分析数据，生成包含核心指标...' },
  { id: 4, icon: '📄', title: '产品调研报告和竞品分析', summary: '收集整理产品或行业名称主要公司的发展现状、产品功能、市场定...' },
  { id: 5, icon: '📊', title: '企业舆情监控和市场策略报告', summary: '请基于提供的信息，生成一份关于{企业名称}在起始时间至结束时...' },
  { id: 6, icon: '🔨', title: '产品发布的官网介绍和预热文案', summary: '{产品名称} 将于{发布时间}发布，帮我搜索互联网和企业知识，制作...' },
  { id: 7, icon: '🟩', title: '大模型技术演进与市场格局综述', summary: '请详细总结今年国内外发布的所有主流大语言模型，包括具体发布...' },
  { id: 8, icon: '🍅', title: '番茄工作法计时器管理工具', summary: '帮我生成一个「番茄工作法计时器」页面，包含任务列表、任务设置...' },
  { id: 9, icon: '✈️', title: '企业团建活动策划方案对象', summary: '设计 3-5 个团建方案，团建人数为{团建人数}，时间安排为{团建...' },
  { id: 10, icon: '🏷️', title: '产品和服务定价策略分析', summary: '作为资深产品定价策略专家 AI 助手，需为{产品或服务名称}制定科...' },
  { id: 11, icon: '📊', title: '企业年度财务报表详细解读', summary: '基于我上传的财务报表 PDF 文件，进行财报信息解读、分析维度包...' },
  { id: 12, icon: '👥', title: '产品和行业战略竞争格局分析', summary: '收集整理产品/行业名称的信息并生成一份完整的行业战略报告，...' },
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

  const handleSend = () => {
    const value = prompt.trim()
    if (!value) return

    setPrompt('')
    navigate('/chat', {
      state: {
        initialPrompt: value,
      },
    })
  }

  const tabItems = [
    {
      key: '最佳实践',
      label: '最佳实践',
      children: (
        <div className={styles.practiceGrid}>
          {BEST_PRACTICE_ITEMS.map((item) => (
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
      ),
    },
    {
      key: '推荐指令',
      label: '推荐指令',
      children: (
        <div className={styles.promptGrid}>
          {RECOMMENDED_PROMPTS.map((item) => (
            <article key={item.id} className={styles.promptCard}>
              <div className={styles.promptTitle}>
                <span>{item.icon}</span>
                <span>{item.title}</span>
              </div>
              <p className={styles.promptSummary}>{item.summary}</p>
            </article>
          ))}
        </div>
      ),
    },
    {
      key: '我的指令',
      label: '我的指令',
      children: <div className={styles.emptyCommands}>暂无指令，请在对话运行后创建指令</div>,
    },
  ]

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.panelContent}>
          <div className={styles.topSection}>
            <div className={styles.hero}>
              <Avatar size={92} src={<img src={homeAvatar} alt="张容悟头像" />} className={styles.heroAvatar} />
              <h1 className={styles.greeting}>Hi 杨金玮，有什么可以帮你的？</h1>
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
      </section>
    </main>
  )
}
