import { useState, useEffect } from 'react'
import { CloseOutlined, BookOutlined, LinkOutlined } from '@ant-design/icons'
import styles from './KnowledgeSpaceModal.module.less'

interface KnowledgeSpaceItem {
  id: string
  name: string
  knowledgeCount: number
  updateTime: string
}

interface KnowledgeSpaceModalProps {
  visible: boolean
  onCancel: () => void
  onConfirm: (selectedIds: string[]) => void
  currentResourceIds: string[]
}

// 模拟知识空间数据，实际应从 API 获取
const mockKnowledgeSpaces: KnowledgeSpaceItem[] = [
  {
    id: 'ks_001',
    name: '11',
    knowledgeCount: 0,
    updateTime: '2026-04-05',
  },
  {
    id: 'ks_002',
    name: '产品需求文档',
    knowledgeCount: 667,
    updateTime: '2026-03-31',
  },
  {
    id: 'ks_003',
    name: 'AAA',
    knowledgeCount: 0,
    updateTime: '2025-12-05',
  },
]

export default function KnowledgeSpaceModal({
  visible,
  onCancel,
  onConfirm,
  currentResourceIds,
}: KnowledgeSpaceModalProps) {
  const [knowledgeSpaces, setKnowledgeSpaces] = useState<KnowledgeSpaceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
      // 初始化选中状态
      setSelectedIds([...currentResourceIds])
      // 加载知识空间列表
      loadKnowledgeSpaces()
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [visible, currentResourceIds])

  const loadKnowledgeSpaces = async () => {
    setLoading(true)
    try {
      // TODO: 替换为实际的 API 调用
      // const response = await fetch('/api/knowledge-spaces')
      // const data = await response.json()
      // setKnowledgeSpaces(data)
      
      // 使用模拟数据
      await new Promise((resolve) => setTimeout(resolve, 300))
      setKnowledgeSpaces(mockKnowledgeSpaces)
    } catch (error) {
      console.error('加载知识空间失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id)
      }
      return [...prev, id]
    })
  }

  const handleConfirm = () => {
    onConfirm(selectedIds)
  }

  const handleGoToKnowledgeSpace = () => {
    // TODO: 跳转到知识空间管理页面
    window.open('/knowledge-space', '_blank')
  }

  if (!visible) return null

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>关联知识空间</h3>
          <div className={styles.headerActions}>
            <button className={styles.linkButton} onClick={handleGoToKnowledgeSpace}>
              <LinkOutlined />
              前往知识空间
            </button>
            <button className={styles.closeButton} onClick={onCancel}>
              <CloseOutlined />
            </button>
          </div>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loadingState}>加载中...</div>
          ) : knowledgeSpaces.length > 0 ? (
            <div className={styles.spaceList}>
              {knowledgeSpaces.map((space) => {
                const isSelected = selectedIds.includes(space.id)
                return (
                  <div key={space.id} className={styles.spaceItem}>
                    <div className={styles.spaceIcon}>
                      <BookOutlined />
                    </div>
                    <div className={styles.spaceInfo}>
                      <div className={styles.spaceName}>{space.name}</div>
                      <div className={styles.spaceMeta}>
                        <span>知识数量：{space.knowledgeCount}</span>
                        <span className={styles.divider}>|</span>
                        <span>更新时间：{space.updateTime}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`${styles.addButton} ${isSelected ? styles.addButtonSelected : ''}`}
                      onClick={() => handleToggleSelect(space.id)}
                    >
                      {isSelected ? '已添加' : '添加'}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>暂无知识空间</div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onCancel}>
            取消
          </button>
          <button className={styles.confirmButton} onClick={handleConfirm}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
