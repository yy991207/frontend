import { useParams, useNavigate } from 'react-router-dom'
import { Button, Avatar, Tag, Tabs } from 'antd'
import {
  ArrowLeftOutlined,
  UserOutlined,
  FireOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import styles from './agentDetail.module.less'

// Mock 数据 - 智能体详情
const mockAgentData: Record<string, {
  id: string
  name: string
  description: string
  avatar: string
  author: { name: string; avatar: string; usage: number }
  tags: string[]
  color: string
  longDescription: string
  features: string[]
  useCases: string[]
}> = {
  '1': {
    id: '1',
    name: '智能客服助手',
    description: '7x24小时在线，自动回复客户咨询',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=1',
    author: { name: '阿里云', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Ali', usage: 12580 },
    tags: ['客服', '自动化', 'AI'],
    color: '#1677ff',
    longDescription: '智能客服助手是一款基于先进 AI 技术的自动化客服解决方案。它能够7x24小时在线，自动回复客户咨询，大幅提升客户服务效率。支持多轮对话、意图识别、情感分析等功能，可广泛应用于电商、金融、教育等多个行业。',
    features: [
      '7x24小时自动回复客户咨询',
      '支持多轮对话和上下文理解',
      '智能意图识别和情感分析',
      '多语言支持，覆盖全球用户',
      '与主流客服系统无缝集成',
    ],
    useCases: [
      '电商平台售前售后咨询',
      '银行理财产品咨询',
      '在线教育课程答疑',
      '物流快递查询服务',
    ],
  },
  '2': {
    id: '2',
    name: '数据分析专家',
    description: '快速分析业务数据，生成可视化报表',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=2',
    author: { name: '腾讯云', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Tencent', usage: 8932 },
    tags: ['数据分析', '可视化', '报表'],
    color: '#52c41a',
    longDescription: '数据分析专家是一款专业的数据分析智能体，能够快速处理和分析海量业务数据，自动生成可视化报表和洞察报告。支持多种数据源接入，提供丰富的图表类型和自定义分析模板。',
    features: [
      '支持多种数据源接入',
      '自动生成可视化报表',
      '智能数据洞察和异常检测',
      '自定义分析模板',
      '一键导出报告',
    ],
    useCases: [
      '销售数据分析',
      '用户行为分析',
      '财务报表生成',
      '运营数据监控',
    ],
  },
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // 获取智能体数据
  const agent = id ? mockAgentData[id] : null

  // 格式化使用数
  const formatUsage = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toLocaleString()
  }

  // 返回上一页
  const handleBack = () => {
    navigate(-1)
  }

  // 跳转到聊天页面
  const handleStartChat = () => {
    navigate('/chat')
  }

  // 如果找不到数据，显示空状态
  if (!agent) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <InfoCircleOutlined className={styles.emptyIcon} />
          <h2>智能体不存在</h2>
          <p>抱歉，您访问的智能体不存在或已被删除</p>
          <Button type="primary" onClick={handleBack}>
            返回发现页
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* 返回按钮 */}
      <div className={styles.backButton} onClick={handleBack}>
        <ArrowLeftOutlined />
        <span>返回</span>
      </div>

      {/* 头部信息 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div
            className={styles.avatar}
            style={{ backgroundColor: `${agent.color}15` }}
          >
            <img src={agent.avatar} alt={agent.name} />
          </div>
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>{agent.name}</h1>
            <p className={styles.subtitle}>{agent.description}</p>
            <div className={styles.tags}>
              {agent.tags.map((tag) => (
                <Tag key={tag} className={styles.tag}>
                  {tag}
                </Tag>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.authorInfo}>
            <Avatar
              size={32}
              src={agent.author.avatar}
              icon={<UserOutlined />}
              className={styles.authorAvatar}
            />
            <span className={styles.authorName}>{agent.author.name}</span>
          </div>
          <div className={styles.usageInfo}>
            <FireOutlined className={styles.usageIcon} />
            <span>{formatUsage(agent.author.usage)} 次使用</span>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className={styles.actions}>
        <Button
          type="primary"
          size="large"
          icon={<MessageOutlined />}
          className={styles.primaryButton}
          onClick={handleStartChat}
        >
          开始对话
        </Button>
        <Button
          size="large"
          icon={<PlayCircleOutlined />}
          className={styles.secondaryButton}
        >
          试用演示
        </Button>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        <Tabs
          defaultActiveKey="overview"
          className={styles.tabs}
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <div className={styles.tabContent}>
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>简介</h3>
                    <p className={styles.sectionText}>{agent.longDescription}</p>
                  </section>

                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>功能特性</h3>
                    <ul className={styles.featureList}>
                      {agent.features.map((feature, index) => (
                        <li key={index} className={styles.featureItem}>
                          <span className={styles.featureDot} style={{ backgroundColor: agent.color }} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>适用场景</h3>
                    <div className={styles.useCaseGrid}>
                      {agent.useCases.map((useCase, index) => (
                        <div key={index} className={styles.useCaseCard}>
                          <span className={styles.useCaseNumber}>{index + 1}</span>
                          <span className={styles.useCaseText}>{useCase}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ),
            },
            {
              key: 'comments',
              label: '评价',
              children: (
                <div className={styles.tabContent}>
                  <div className={styles.emptyComments}>
                    <p>暂无评价</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'related',
              label: '相关智能体',
              children: (
                <div className={styles.tabContent}>
                  <div className={styles.emptyRelated}>
                    <p>暂无相关智能体</p>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
