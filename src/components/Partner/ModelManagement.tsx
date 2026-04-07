import { useState, useCallback } from 'react'
import {
  ThunderboltOutlined,
  RobotOutlined,
  CodeOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import styles from './ModelManagement.module.less'

// 模型配置项类型
export interface ModelConfig {
  id: string
  name: string
  description: string
  icon: string
  provider: string
}

interface ModelManagementProps {
  models?: ModelConfig[]
  selectedModelId?: string
  loading?: boolean
  onSelectModel?: (modelId: string) => void
}

// 默认模型列表（参考设计稿）
const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'auto',
    name: '智能选择',
    description: '多模型智能调度，基于「效果 + 速度」双维度智能匹配最优算力与模型组合，支持优先尝鲜平台内最新模型能力',
    icon: 'zhineng',
    provider: '系统',
  },
  {
    id: 'doubao-seed-2.0-lite',
    name: 'Doubao-Seed-2.0-lite',
    description: '兼顾生成质量与响应速度的通用生产级模型，擅长非结构化信息处理、内容创作、搜索推荐、数据分析等生产型任务（由火山方舟提供）',
    icon: 'doubao',
    provider: '火山方舟',
  },
  {
    id: 'deepseek-v3.2',
    name: 'DeepSeek-V3.2',
    description: '兼顾推理能力与输出长度，在通用问答、日常智能体任务、轻量级代码开发场景中稳定高效，适配多元 AI 需求（由火山方舟提供）',
    icon: 'deepseek',
    provider: '火山方舟',
  },
  {
    id: 'kimi-k2.5',
    name: 'Kimi-K2.5',
    description: 'Moonshot AI 最新编程模型，进一步强化前端代码质量与设计表现力（由模型厂商提供）',
    icon: 'kimi',
    provider: 'Moonshot AI',
  },
  {
    id: 'glm-5',
    name: 'GLM-5',
    description: '智谱 AI 旗舰大模型，擅长解析超长代码库、处理复杂智能体任务，在代码生成、调试、全链路理解场景中表现优异（由模型厂商提供）',
    icon: 'glm',
    provider: '智谱 AI',
  },
  {
    id: 'minimax-m2.5',
    name: 'MiniMax-M2.5',
    description: 'MiniMax 旗舰级开源大模型，适配编程、工具调用、搜索和办公等生产力场景（由模型厂商提供）',
    icon: 'minimax',
    provider: 'MiniMax',
  },
]

// 获取图标组件
function getModelIcon(iconType: string) {
  switch (iconType) {
    case 'zhineng':
      return <ThunderboltOutlined />
    case 'doubao':
      return <RobotOutlined />
    case 'deepseek':
      return <CodeOutlined />
    case 'kimi':
      return <FileTextOutlined />
    case 'glm':
      return <DatabaseOutlined />
    case 'minimax':
      return <ApiOutlined />
    default:
      return <RobotOutlined />
  }
}

// 获取图标样式类名
function getIconClass(iconType: string): string {
  switch (iconType) {
    case 'zhineng':
      return styles.iconZhineng
    case 'doubao':
      return styles.iconDoubao
    case 'deepseek':
      return styles.iconDeepseek
    case 'kimi':
      return styles.iconKimi
    case 'glm':
      return styles.iconGLM
    case 'minimax':
      return styles.iconMiniMax
    default:
      return styles.iconDefault
  }
}

export default function ModelManagement({
  models = DEFAULT_MODELS,
  selectedModelId = 'auto',
  loading = false,
  onSelectModel,
}: ModelManagementProps) {
  const [selectedId, setSelectedId] = useState(selectedModelId)

  const handleSelect = useCallback(
    (modelId: string) => {
      setSelectedId(modelId)
      onSelectModel?.(modelId)
    },
    [onSelectModel]
  )

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>加载中...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>模型管理</h2>
        <p className={styles.subtitle}>
          优先使用所选模型，若所选模型暂不可用，当次会话将自动切换至智能选择模式
        </p>
      </div>

      <div className={styles.modelList}>
        {models.map((model) => (
          <div
            key={model.id}
            className={`${styles.modelCard} ${
              selectedId === model.id ? styles.modelCardSelected : ''
            }`}
            onClick={() => handleSelect(model.id)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.radioWrap}>
              <div className={styles.radio}>
                <div className={styles.radioInner} />
              </div>
            </div>
            <div className={`${styles.iconWrap} ${getIconClass(model.icon)}`}>
              {getModelIcon(model.icon)}
            </div>
            <div className={styles.content}>
              <div className={styles.modelName}>{model.name}</div>
              <div className={styles.modelDesc}>{model.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
