import { useEffect, useRef, useState } from 'react'
import { Avatar, Input, Tabs } from 'antd'
import {
  AudioOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  CloseOutlined,
  FileTextOutlined,
  SnippetsOutlined,
  GlobalOutlined,
  DashboardOutlined,
  TableOutlined,
  PictureOutlined,
  FileExcelOutlined,
  MessageOutlined,
  PaperClipOutlined,
  FileAddOutlined,
  PlusOutlined,
  RightOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
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

// 卡片改成内容预览，避免继续只显示一块纯色封面。
const MOCK_CARDS = [
  {
    id: 1,
    toneClassName: 'cardPreviewAmber',
    eyebrow: '个人策略',
    title: 'AlbertYang：战略规划者 × 效率优化师',
    summary: '把长期方向拆成季度动作、协同节点和风险提醒，方便直接开干。',
    metric: '12 周推进表',
    bars: [84, 66, 92],
    tags: ['战略拆解', '执行节奏'],
  },
  {
    id: 2,
    toneClassName: 'cardPreviewSky',
    eyebrow: '市场分析',
    title: 'OpenAI 关停 Sora 及多模态生成市场分析报告',
    summary: '补充竞品格局、影响判断和后续机会点，阅读时能先抓重点。',
    metric: '8 个关键结论',
    bars: [76, 90, 58],
    tags: ['竞品格局', '影响评估'],
  },
  {
    id: 3,
    toneClassName: 'cardPreviewRose',
    eyebrow: '行业周报',
    title: 'AI INDUSTRY 洞察周报',
    summary: '按融资、产品、模型和团队动态分层整理，适合一眼扫完本周重点。',
    metric: '本周 24 条动态',
    bars: [68, 86, 74],
    tags: ['趋势速览', '团队动态'],
  },
]

const TAB_ITEMS = ['最佳实践', '推荐指令', '我的指令'].map((label) => ({
  key: label,
  label,
  children: (
    <div className={styles.cardGrid}>
      {MOCK_CARDS.map((card) => (
        <div key={card.id} className={styles.card}>
          <div className={`${styles.cardPreview} ${styles[card.toneClassName]}`}>
            <div className={styles.cardPreviewHead}>
              <span className={styles.cardEyebrow}>{card.eyebrow}</span>
              <span className={styles.cardMetric}>{card.metric}</span>
            </div>
            <div className={styles.cardPreviewBody}>
              <div className={styles.previewBars}>
                {card.bars.map((width, index) => (
                  <span
                    key={`${card.id}-${index}`}
                    className={styles.previewBar}
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
              <div className={styles.previewFooter}>
                {card.tags.map((tag) => (
                  <span key={tag} className={styles.previewTag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.cardTitle}>{card.title}</div>
          <div className={styles.cardSummary}>{card.summary}</div>
        </div>
      ))}
    </div>
  ),
}))

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
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

  return (
    <main className={styles.page}>
      {/* 头像 + 问候 */}
      <div className={styles.hero}>
        <Avatar
          size={92}
          src={<img src={homeAvatar} alt="张容悟头像" />}
          className={styles.heroAvatar}
        />
        <h1 className={styles.greeting}>Hi～ 有什么可以帮你的？</h1>
      </div>

      {/* 输入框 */}
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
            style={{ flex: 1, border: 'none', boxShadow: 'none', background: 'transparent', fontSize: 14 }}
            variant="borderless"
            placeholder="想做点什么呢～"
          />
          <span className={styles.tabHint}>Tab</span>
          <div className={styles.inputActions}>
            <button type="button" className={styles.iconBtn}>
              <AudioOutlined />
            </button>
            <button type="button" className={`${styles.iconBtn} ${styles.sendBtn}`}>
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

      {/* 快捷指令 */}
      <div className={`${styles.quickActions} scroll-x-hidden`}>
        {QUICK_ACTIONS.map((action) => (
          <div key={action.label} className={styles.quickTag}>
            <span className={styles.quickTagIcon}>{action.icon}</span>
            <span>{action.label}</span>
          </div>
        ))}
      </div>

      {/* Tab + 卡片 */}
      <div className={styles.bottom}>
        <Tabs items={TAB_ITEMS} />
      </div>
    </main>
  )
}
