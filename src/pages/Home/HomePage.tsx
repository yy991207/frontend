import { Avatar, Input, Tabs } from 'antd'
import {
  PlusCircleOutlined,
  AudioOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  FileTextOutlined,
  SnippetsOutlined,
  GlobalOutlined,
  DashboardOutlined,
  TableOutlined,
  PictureOutlined,
  FileExcelOutlined,
  MessageOutlined,
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
  return (
    <main className={styles.page}>
      {/* 头像 + 问候 */}
      <div className={styles.hero}>
        <Avatar
          size={92}
          src={<img src={homeAvatar} alt="张容悟头像" />}
          className={styles.heroAvatar}
        />
        <h1 className={styles.greeting}>Hi 张容悟，有什么可以帮你的？</h1>
      </div>

      {/* 输入框 */}
      <div className={styles.inputWrap}>
        <button className={styles.iconBtn} onClick={() => console.log('+')}>
          <PlusCircleOutlined />
        </button>
        <Input
          style={{ flex: 1, border: 'none', boxShadow: 'none', background: 'transparent', fontSize: 14 }}
          variant="borderless"
          placeholder="总结罗振宇 2026 跨年演讲金句，生成一组图片"
        />
        <span className={styles.tabHint}>Tab</span>
        <div className={styles.inputActions}>
          <button className={styles.iconBtn}>
            <AudioOutlined />
          </button>
          <button className={`${styles.iconBtn} ${styles.sendBtn}`}>
            <ArrowUpOutlined />
          </button>
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
