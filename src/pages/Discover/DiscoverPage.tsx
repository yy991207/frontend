import { useState, useRef, useEffect } from 'react'
import { Pagination } from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  LoadingOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import CreateAgentModal from '../../components/common/CreateAgentModal'
import { AppPageShell, AppSurfacePanel } from '../../components/layout/AppPageShell'
import {
  loadCustomAgentApiConfig,
  getAgentUsageLogs,
  addAgentUsageLog,
  listCustomAgents,
  listOfficialAgents,
  type OfficialAgentItem,
} from '../../services/customAgentService'
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

export default function DiscoverPage() {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [currentFeaturedPage, setCurrentFeaturedPage] = useState(0)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const featuredContainerRef = useRef<HTMLDivElement>(null)
  const [myCreatedAgents, setMyCreatedAgents] = useState<MyCreatedAgent[]>([])
  const [myCreatedLoading, setMyCreatedLoading] = useState(false)
  const [featuredAgents, setFeaturedAgents] = useState<OfficialAgentItem[]>([])
  const [featuredAgentsLoading, setFeaturedAgentsLoading] = useState(false)
  const [myCreatedPage, setMyCreatedPage] = useState(1)
  const myCreatedPageSize = 16

  useEffect(() => {
    let cancelled = false

    async function fetchMyCreatedAgents() {
      setMyCreatedLoading(true)
      try {
        const config = await loadCustomAgentApiConfig()
        const agents = await listCustomAgents(config)
        if (!cancelled) {
          setMyCreatedAgents(agents)
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

  useEffect(() => {
    let cancelled = false

    async function fetchFeaturedAgents() {
      setFeaturedAgentsLoading(true)
      try {
        const config = await loadCustomAgentApiConfig()
        const agents = await listOfficialAgents(config)
        if (!cancelled) {
          setFeaturedAgents(agents)
          setCurrentFeaturedPage(0)
        }
      } catch (error) {
        console.error('获取官方智能体列表失败:', error)
      } finally {
        if (!cancelled) {
          setFeaturedAgentsLoading(false)
        }
      }
    }

    fetchFeaturedAgents()

    return () => {
      cancelled = true
    }
  }, [])

  const normalizedSearchValue = searchValue.trim().toLowerCase()
  const filteredFeaturedAgents = featuredAgents.filter((agent) => (
    !normalizedSearchValue ||
    agent.agent_name.toLowerCase().includes(normalizedSearchValue) ||
    agent.description.toLowerCase().includes(normalizedSearchValue)
  ))
  const filteredMyCreatedAgents = myCreatedAgents.filter((agent) => (
    !normalizedSearchValue ||
    agent.agent_name.toLowerCase().includes(normalizedSearchValue) ||
    agent.description.toLowerCase().includes(normalizedSearchValue)
  ))

  // 每页显示10个企业精选卡片（两行，每行5个）
  const featuredPageSize = 10
  const totalFeaturedPages = Math.max(1, Math.ceil(filteredFeaturedAgents.length / featuredPageSize))

  // 获取当前页的企业精选数据
  const getCurrentFeaturedAgents = () => {
    const start = currentFeaturedPage * featuredPageSize
    return filteredFeaturedAgents.slice(start, start + featuredPageSize)
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
    <AppPageShell>
      <AppSurfacePanel as="div" className={styles.pageInner}>
        {/* 粘性头部 */}
        <div className={styles.stickyHeader}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>发现</h1>
            <div className={styles.headerRight}>
              <div className={styles.searchBox}>
                <SearchOutlined className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInputEl}
                  placeholder="搜索智能体"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={styles.createButton}
                onClick={handleOpenModal}
              >
                <PlusOutlined />
                创建智能体
              </button>
            </div>
          </div>
        </div>

        {/* 内容区 */}
        <div className={styles.contentArea}>
          {/* 企业精选区域 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>企业精选</h2>
              <div className={styles.sectionNav}>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={handlePrevPage}
                  disabled={currentFeaturedPage === 0}
                  aria-label="上一页"
                >
                  <LeftOutlined />
                </button>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={handleNextPage}
                  disabled={currentFeaturedPage >= totalFeaturedPages - 1}
                  aria-label="下一页"
                >
                  <RightOutlined />
                </button>
              </div>
            </div>
            <div className={styles.featuredGrid} ref={featuredContainerRef}>
              {featuredAgentsLoading ? (
                <div className={styles.loadingContainer}>
                  <LoadingOutlined className={styles.loadingIcon} />
                  <span>加载中...</span>
                </div>
              ) : getCurrentFeaturedAgents().length > 0 ? (
                getCurrentFeaturedAgents().map((agent) => (
                  <div
                    key={agent.agent_id}
                    className={styles.featuredCard}
                    onClick={() => handleAgentChat(agent.agent_id)}
                  >
                    <div className={styles.featuredCardIcon}>
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt={agent.agent_name} className={styles.featuredCardAvatarImage} />
                      ) : (
                        <span>{getAvatarLetter(agent.agent_name)}</span>
                      )}
                      <div className={styles.featuredCardBadge}>
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFUAAABUCAYAAADzqXv/AAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAovSURBVHgB7VtbaBRXGP7OmdAo" alt="" />
                      </div>
                    </div>
                    <h3 className={styles.featuredCardTitle}>{agent.agent_name}</h3>
                    <p className={styles.featuredCardDesc}>{agent.description}</p>
                    <div className={styles.featuredCardMeta}>
                      <div className={styles.metaAuthor}>
                        <span>@果仁官方</span>
                      </div>
                      <div className={styles.metaDivider} />
                      <div className={styles.metaUsage}>
                        <MessageOutlined />
                        <span>{formatUsage(0)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyContainer}>暂无官方智能体</div>
              )}
            </div>
          </section>

          {/* 我创建的智能体区域 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>自建智能体</h2>
            </div>
            <div className={styles.enterpriseGrid}>
              {myCreatedLoading ? (
                <div className={styles.loadingContainer}>
                  <LoadingOutlined className={styles.loadingIcon} />
                  <span>加载中...</span>
                </div>
              ) : filteredMyCreatedAgents.length > 0 ? (
                filteredMyCreatedAgents
                  .slice((myCreatedPage - 1) * myCreatedPageSize, myCreatedPage * myCreatedPageSize)
                  .map((agent) => (
                    <div
                      key={agent.agent_id}
                      className={styles.enterpriseCard}
                      onClick={() => handleAgentChat(agent.agent_id)}
                    >
                      <div className={styles.enterpriseAvatar}>
                        <span>{getAvatarLetter(agent.agent_name)}</span>
                      </div>
                      <div className={styles.enterpriseCardInfo}>
                        <h3 className={styles.enterpriseCardTitle}>{agent.agent_name}</h3>
                        <p className={styles.enterpriseCardDesc}>{agent.description}</p>
                        <div className={styles.enterpriseCardMeta}>
                          <div className={styles.metaAuthor}>
                            <span>我创建的</span>
                          </div>
                          <div className={styles.metaDivider} />
                          <div className={styles.metaUsage}>
                            <MessageOutlined />
                            <span>0</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className={styles.emptyContainer}>暂无创建的智能体</div>
              )}
            </div>
            {filteredMyCreatedAgents.length > myCreatedPageSize && (
              <div className={styles.paginationWrapper}>
                <Pagination
                  current={myCreatedPage}
                  pageSize={myCreatedPageSize}
                  total={filteredMyCreatedAgents.length}
                  onChange={(page) => setMyCreatedPage(page)}
                  showSizeChanger={false}
                  showTotal={(total) => `共 ${total} 个`}
                />
              </div>
            )}
          </section>
        </div>
      </AppSurfacePanel>

      {/* 创建智能体弹窗 */}
      <CreateAgentModal
        visible={isModalVisible}
        onCancel={handleCloseModal}
      />
    </AppPageShell>
  )
}
