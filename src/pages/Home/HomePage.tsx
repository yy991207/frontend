import { Avatar, Input, Tabs } from 'antd'
import { PlusCircleOutlined, AudioOutlined, ArrowUpOutlined } from '@ant-design/icons'
import styles from './home.module.less'

const QUICK_ACTIONS = [
  { emoji: '📊', label: '生成 PPT' },
  { emoji: '🎨', label: '生成创意 PPT' },
  { emoji: '📄', label: '写云文档' },
  { emoji: '📋', label: '写报告' },
  { emoji: '🌐', label: '搭建网页' },
  { emoji: '📈', label: '搭建仪表盘' },
  { emoji: '📊', label: '创建多维表格' },
  { emoji: '🖼️', label: '生成图片' },
  { emoji: '📑', label: 'Excel' },
  { emoji: '💬', label: '对话模式' },
]

const MOCK_CARDS = [
  {
    id: 1,
    bg: 'linear-gradient(135deg, #f97316, #fb923c)',
    title: 'AlbertYang：战略规划者 × 效率优化师',
  },
  {
    id: 2,
    bg: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    title: 'OpenAI 关停 Sora 及多模态生成市场分析报告',
  },
  {
    id: 3,
    bg: 'linear-gradient(135deg, #f43f5e, #fb7185)',
    title: 'AI INDUSTRY 洞察周报',
  },
]

const TAB_ITEMS = ['最佳实践', '推荐指令', '我的指令'].map((label) => ({
  key: label,
  label,
  children: (
    <div className={styles.cardGrid}>
      {MOCK_CARDS.map((card) => (
        <div key={card.id} style={{ cursor: 'pointer' }}>
          <div className={styles.cardImage} style={{ background: card.bg }} />
          <div className={styles.cardTitle}>{card.title}</div>
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
          size={80}
          style={{
            background: 'linear-gradient(135deg, #b39ddb, #9fa8da)',
            fontSize: 32,
          }}
        >
          AI
        </Avatar>
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
            <span>{action.emoji}</span>
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
