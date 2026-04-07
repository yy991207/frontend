import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Button, Dropdown, message } from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  DownOutlined,
  FireOutlined,
} from '@ant-design/icons'
import CreateAgentModal from '../../components/common/CreateAgentModal'
import styles from './discover.module.less'

// 本地图片资源
const localImages = [
  '/img/ScreenShot_2026-04-07_175908_563.png',
  '/img/ScreenShot_2026-04-07_175930_033.png',
  '/img/ScreenShot_2026-04-07_175937_566.png',
  '/img/ScreenShot_2026-04-07_180223_916.png',
  '/img/ScreenShot_2026-04-07_180238_348.png',
  '/img/ScreenShot_2026-04-07_180301_473.png',
  '/img/ScreenShot_2026-04-07_180409_903.png',
  '/img/ScreenShot_2026-04-07_180418_553.png',
  '/img/ScreenShot_2026-04-07_180425_683.png',
  '/img/ScreenShot_2026-04-07_180431_524.png',
  '/img/ScreenShot_2026-04-07_180438_183.png',
  '/img/ScreenShot_2026-04-07_180446_294.png',
]

// Mock 数据 - 企业精选
const featuredAgents = [
  {
    id: 1,
    name: '智能客服助手',
    description: '7x24小时在线，自动回复客户咨询',
    avatar: localImages[0],
    author: { name: '阿里云', avatar: localImages[1], usage: 12580 },
    color: '#1677ff',
  },
  {
    id: 2,
    name: '数据分析专家',
    description: '快速分析业务数据，生成可视化报表',
    avatar: localImages[2],
    author: { name: '腾讯云', avatar: localImages[3], usage: 8932 },
    color: '#52c41a',
  },
  {
    id: 3,
    name: '代码审查助手',
    description: '自动检测代码问题，提升代码质量',
    avatar: localImages[4],
    author: { name: 'GitHub', avatar: localImages[5], usage: 15670 },
    color: '#722ed1',
  },
  {
    id: 4,
    name: '文档生成器',
    description: '根据代码自动生成技术文档',
    avatar: localImages[6],
    author: { name: 'Notion', avatar: localImages[7], usage: 6789 },
    color: '#fa8c16',
  },
  {
    id: 5,
    name: '会议纪要助手',
    description: '实时转录会议内容，自动生成摘要',
    avatar: localImages[8],
    author: { name: '飞书', avatar: localImages[9], usage: 9876 },
    color: '#eb2f96',
  },
  {
    id: 6,
    name: '营销文案生成',
    description: '一键生成高质量营销文案',
    avatar: localImages[10],
    author: { name: '字节跳动', avatar: localImages[11], usage: 23456 },
    color: '#f5222d',
  },
  {
    id: 7,
    name: '智能翻译官',
    description: '支持多语言实时翻译',
    avatar: localImages[0],
    author: { name: 'DeepL', avatar: localImages[1], usage: 11234 },
    color: '#13c2c2',
  },
  {
    id: 8,
    name: 'PPT设计师',
    description: '自动生成精美PPT演示文稿',
    avatar: localImages[2],
    author: { name: 'Canva', avatar: localImages[3], usage: 14567 },
    color: '#faad14',
  },
  {
    id: 9,
    name: '邮件助手',
    description: '智能撰写和回复邮件',
    avatar: localImages[4],
    author: { name: 'Gmail', avatar: localImages[5], usage: 18901 },
    color: '#1890ff',
  },
  {
    id: 10,
    name: '日程管理师',
    description: '智能安排日程，提醒重要事项',
    avatar: localImages[6],
    author: { name: 'Google', avatar: localImages[7], usage: 7654 },
    color: '#2f54eb',
  },
]

// Mock 数据 - 企业智能体
const enterpriseAgents = [
  {
    id: 1,
    name: '企业知识库助手',
    description: '基于企业知识库，快速回答员工问题，提升工作效率',
    avatar: localImages[8],
    author: { name: '钉钉', avatar: localImages[9], usage: 56789 },
    tags: ['企业', '知识管理'],
  },
  {
    id: 2,
    name: '财务报表分析',
    description: '自动分析财务报表，识别异常数据，生成分析报告',
    avatar: localImages[10],
    author: { name: '金蝶', avatar: localImages[11], usage: 34567 },
    tags: ['财务', '数据分析'],
  },
  {
    id: 3,
    name: 'HR招聘助手',
    description: '智能筛选简历，自动安排面试，跟踪招聘进度',
    avatar: localImages[0],
    author: { name: 'BOSS直聘', avatar: localImages[1], usage: 42345 },
    tags: ['HR', '招聘'],
  },
  {
    id: 4,
    name: '合同审查专家',
    description: '自动审查合同条款，识别风险点，提供修改建议',
    avatar: localImages[2],
    author: { name: '法大大', avatar: localImages[3], usage: 28901 },
    tags: ['法务', '合同'],
  },
  {
    id: 5,
    name: 'IT运维监控',
    description: '实时监控系统状态，自动告警，快速定位故障',
    avatar: localImages[4],
    author: { name: 'Zabbix', avatar: localImages[5], usage: 15678 },
    tags: ['IT', '运维'],
  },
  {
    id: 6,
    name: '客户画像分析',
    description: '整合客户数据，构建精准画像，助力精准营销',
    avatar: localImages[6],
    author: { name: 'Salesforce', avatar: localImages[7], usage: 51234 },
    tags: ['CRM', '营销'],
  },
]

// 排序选项
const sortOptions = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '最热' },
  { key: 'usage', label: '使用最多' },
]

export default function DiscoverPage() {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [currentFeaturedPage, setCurrentFeaturedPage] = useState(0)
  const [sortBy, setSortBy] = useState('latest')
  const [isModalVisible, setIsModalVisible] = useState(false)
  const featuredContainerRef = useRef<HTMLDivElement>(null)

  // 每页显示5个企业精选卡片
  const featuredPageSize = 5
  const totalFeaturedPages = Math.ceil(featuredAgents.length / featuredPageSize)

  // 获取当前页的企业精选数据
  const getCurrentFeaturedAgents = () => {
    const start = currentFeaturedPage * featuredPageSize
    return featuredAgents.slice(start, start + featuredPageSize)
  }

  // 处理左右导航
  const handlePrevPage = () => {
    setCurrentFeaturedPage((prev) => (prev > 0 ? prev - 1 : totalFeaturedPages - 1))
  }

  const handleNextPage = () => {
    setCurrentFeaturedPage((prev) => (prev < totalFeaturedPages - 1 ? prev + 1 : 0))
  }

  // 处理排序
  const handleSortChange = (key: string) => {
    setSortBy(key)
  }

  // 格式化使用数
  const formatUsage = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toLocaleString()
  }

  // 打开创建智能体弹窗
  const handleOpenModal = () => {
    setIsModalVisible(true)
  }

  // 关闭创建智能体弹窗
  const handleCloseModal = () => {
    setIsModalVisible(false)
  }

  // 确认创建智能体
  const handleConfirmCreate = async (data: { name: string; description: string; icon: string }) => {
    // 模拟创建过程
    await new Promise((resolve) => setTimeout(resolve, 500))
    message.success(`智能体 "${data.name}" 创建成功！`)
    setIsModalVisible(false)
    // 可以在这里添加跳转到新创建的智能体详情页的逻辑
  }

  // 跳转到智能体详情页
  const handleNavigateToAgent = (agentId: number) => {
    navigate(`/agent/${agentId}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.discoverPage}>
          {/* 页面头部 */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h1 className={styles.title}>发现</h1>
            </div>
            <div className={styles.headerRight}>
              <div className={styles.searchBox}>
                <SearchOutlined className={styles.searchIcon} />
                <Input
                  placeholder="搜索智能体"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className={styles.searchInput}
                  bordered={false}
                />
              </div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className={styles.createButton}
                onClick={handleOpenModal}
              >
                创建智能体
              </Button>
            </div>
          </div>

          {/* 企业精选区域 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>企业精选</h2>
              <div className={styles.sectionNav}>
                <button
                  className={styles.navButton}
                  onClick={handlePrevPage}
                  aria-label="上一页"
                >
                  <LeftOutlined />
                </button>
                <button
                  className={styles.navButton}
                  onClick={handleNextPage}
                  aria-label="下一页"
                >
                  <RightOutlined />
                </button>
              </div>
            </div>
            <div className={styles.featuredGrid} ref={featuredContainerRef}>
              {getCurrentFeaturedAgents().map((agent) => (
                <div key={agent.id} className={styles.featuredCard}>
                  <div className={styles.featuredCardHeader}>
                    <div
                      className={styles.featuredAvatar}
                      style={{ backgroundColor: `${agent.color}15` }}
                    >
                      <img src={agent.avatar} alt={agent.name} />
                    </div>
                  </div>
                  <div className={styles.featuredCardBody}>
                    <h3 className={styles.featuredCardTitle}>{agent.name}</h3>
                    <p className={styles.featuredCardDesc}>{agent.description}</p>
                  </div>
                  <div className={styles.featuredCardFooter}>
                    <div className={styles.authorInfo}>
                      <span className={styles.authorName}>{agent.author.name}</span>
                    </div>
                    <div className={styles.usageInfo}>
                      <FireOutlined className={styles.usageIcon} />
                      <span>{formatUsage(agent.author.usage)}</span>
                    </div>
                  </div>
                  {/* 使用按钮 */}
                  <button
                    className={styles.useButton}
                    data-testid="agent-use-button"
                    onClick={() => handleNavigateToAgent(agent.id)}
                  >
                    使用
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 企业智能体区域 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>企业智能体</h2>
              <Dropdown
                menu={{
                  items: sortOptions.map((opt) => ({
                    key: opt.key,
                    label: opt.label,
                    onClick: () => handleSortChange(opt.key),
                  })),
                  selectedKeys: [sortBy],
                }}
                placement="bottomRight"
              >
                <button className={styles.sortButton}>
                  {sortOptions.find((opt) => opt.key === sortBy)?.label}
                  <DownOutlined className={styles.sortIcon} />
                </button>
              </Dropdown>
            </div>
            <div className={styles.enterpriseGrid}>
              {enterpriseAgents.map((agent) => (
                <div key={agent.id} className={styles.enterpriseCard}>
                  <div className={styles.enterpriseCardLeft}>
                    <div className={styles.enterpriseAvatar}>
                      <img src={agent.avatar} alt={agent.name} />
                    </div>
                  </div>
                  <div className={styles.enterpriseCardRight}>
                    <h3 className={styles.enterpriseCardTitle}>{agent.name}</h3>
                    <p className={styles.enterpriseCardDesc}>{agent.description}</p>
                    <div className={styles.enterpriseCardFooter}>
                      <div className={styles.authorInfo}>
                        <span className={styles.authorName}>{agent.author.name}</span>
                      </div>
                      <div className={styles.usageInfo}>
                        <FireOutlined className={styles.usageIcon} />
                        <span>{formatUsage(agent.author.usage)}</span>
                      </div>
                    </div>
                  </div>
                  {/* 使用按钮 */}
                  <button
                    className={styles.useButton}
                    data-testid="agent-use-button"
                    onClick={() => handleNavigateToAgent(agent.id)}
                  >
                    使用
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 创建智能体弹窗 */}
      <CreateAgentModal
        visible={isModalVisible}
        onCancel={handleCloseModal}
        onConfirm={handleConfirmCreate}
      />
    </div>
  )
}
