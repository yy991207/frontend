import { useState, useRef, useEffect } from 'react'
import { Input, Button, Pagination } from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  LoadingOutlined,
  FireOutlined,
  MessageOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import CreateAgentModal from '../../components/common/CreateAgentModal'
import { loadCustomAgentApiConfig, getAgentUsageLogs, addAgentUsageLog } from '../../services/customAgentService'
import { notifyAgentUsageLogRefresh } from '../../services/chatSessionEvents'
import styles from './discover.module.less'

function getAvatarLetter(name: string) {
  return name?.trim().charAt(0).toUpperCase() || 'A'
}

type MyCreatedAgent = {
  agent_id: string
  agent_name: string
  description: string
}

// Mock 数据 - 企业精选
const featuredAgents = [
  {
    id: 1,
    name: '智能客服助手',
    description: '7x24小时在线，自动回复客户咨询',
    author: { name: '@果仁官方', usage: 12580 },
  },
  {
    id: 2,
    name: '数据分析专家',
    description: '快速分析业务数据，生成可视化报表',
    author: { name: '@果仁官方', usage: 8932 },
  },
  {
    id: 3,
    name: '代码审查助手',
    description: '自动检测代码问题，提升代码质量',
    author: { name: '@果仁官方', usage: 15670 },
  },
  {
    id: 4,
    name: '文档生成器',
    description: '根据代码自动生成技术文档',
    author: { name: '@果仁官方', usage: 6789 },
  },
  {
    id: 5,
    name: '会议纪要助手',
    description: '实时转录会议内容，自动生成摘要',
    author: { name: '@果仁官方', usage: 9876 },
  },
  {
    id: 6,
    name: '营销文案生成',
    description: '一键生成高质量营销文案',
    author: { name: '@果仁官方', usage: 23456 },
  },
  {
    id: 7,
    name: '智能翻译官',
    description: '支持多语言实时翻译',
    author: { name: '@果仁官方', usage: 11234 },
  },
  {
    id: 8,
    name: 'PPT设计师',
    description: '自动生成精美PPT演示文稿',
    author: { name: '@果仁官方', usage: 14567 },
  },
  {
    id: 9,
    name: '邮件助手',
    description: '智能撰写和回复邮件',
    author: { name: '@果仁官方', usage: 18901 },
  },
  {
    id: 10,
    name: '日程管理师',
    description: '智能安排日程，提醒重要事项',
    author: { name: '@果仁官方', usage: 7654 },
  },
]


export default function DiscoverPage() {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [currentFeaturedPage, setCurrentFeaturedPage] = useState(0)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const featuredContainerRef = useRef<HTMLDivElement>(null)
  const [myCreatedAgents, setMyCreatedAgents] = useState<MyCreatedAgent[]>([])
  const [myCreatedLoading, setMyCreatedLoading] = useState(false)
  const [myCreatedPage, setMyCreatedPage] = useState(1)
  const myCreatedPageSize = 16

  useEffect(() => {
    let cancelled = false

    async function fetchMyCreatedAgents() {
      setMyCreatedLoading(true)
      try {
        const response = await fetch('http://192.168.30.238:8000/api/v1/custom-agents?user_id=123456', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json()
        if (!cancelled && data.success && data.data?.agents) {
          setMyCreatedAgents(data.data.agents)
        }
      } catch (error) {
        console.error('获取我创建的智能体列表失败:', error)
      } finally {
        if (!cancelled) {
          setMyCreatedLoading(false)
        }
      }
    }

    fetchMyCreatedAgents()

    return () => {
      cancelled = true
    }
  }, [])

  // 每页显示10个企业精选卡片（两行，每行5个）
  const featuredPageSize = 10
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

  const handleAgentChat = async (agentId: string) => {
    try {
      const config = await loadCustomAgentApiConfig()
      const existingLogs = await getAgentUsageLogs(config)
      const alreadyExists = existingLogs.some((log) => log.agent_id === agentId)

      if (!alreadyExists) {
        await addAgentUsageLog(config, agentId)
        notifyAgentUsageLogRefresh()
      }
    } catch (error) {
      console.error('添加智能体使用记录失败:', error)
    }

    navigate(`/agent/${agentId}/chat`)
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
                  variant="borderless"
                />
              </div>
              <Button
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
                    <div className={styles.featuredAvatar}>
                      <span className={styles.avatarLetter}>{getAvatarLetter(agent.name)}</span>
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
                </div>
              ))}
            </div>
          </section>

          {/* 我创建的智能体区域 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>我创建的</h2>
            </div>
            <div className={styles.enterpriseGrid}>
              {myCreatedLoading ? (
                <div className={styles.loadingContainer}>
                  <LoadingOutlined className={styles.loadingIcon} />
                  <span>加载中...</span>
                </div>
              ) : myCreatedAgents.length > 0 ? (
                myCreatedAgents
                  .slice((myCreatedPage - 1) * myCreatedPageSize, myCreatedPage * myCreatedPageSize)
                  .map((agent) => (
                    <div key={agent.agent_id} className={styles.enterpriseCard}>
                      <div className={styles.enterpriseCardLeft}>
                        <div className={styles.enterpriseAvatar}>
                          <span className={styles.avatarLetter}>{getAvatarLetter(agent.agent_name)}</span>
                        </div>
                      </div>
                      <div className={styles.enterpriseCardRight}>
                        <h3 className={styles.enterpriseCardTitle}>{agent.agent_name}</h3>
                        <p className={styles.enterpriseCardDesc}>{agent.description}</p>
                      </div>
                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => handleAgentChat(agent.agent_id)}
                          aria-label="对话"
                        >
                          <MessageOutlined />
                        </button>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => navigate(`/agent/${agent.agent_id}`)}
                          aria-label="设置"
                        >
                          <SettingOutlined />
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className={styles.emptyContainer}>暂无创建的智能体</div>
              )}
            </div>
            {myCreatedAgents.length > myCreatedPageSize && (
              <div className={styles.paginationWrapper}>
                <Pagination
                  current={myCreatedPage}
                  pageSize={myCreatedPageSize}
                  total={myCreatedAgents.length}
                  onChange={(page) => setMyCreatedPage(page)}
                  showSizeChanger={false}
                  showTotal={(total) => `共 ${total} 个`}
                />
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 创建智能体弹窗 */}
      <CreateAgentModal
        visible={isModalVisible}
        onCancel={handleCloseModal}
      />
    </div>
  )
}
