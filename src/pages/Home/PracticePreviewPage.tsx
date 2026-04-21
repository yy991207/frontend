import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AppPageShell, AppSurfacePanel } from '../../components/layout/AppPageShell'
import { MessageList } from '../../components/chat/message-list'
import { adaptChatMessages } from '../../core/messages/adapters'
import { groupMessages } from '../../core/messages/utils'
import { fetchCommands } from '../../services/commandsService'
import type { LegacyChatMessage, MessageGroup } from '../../core/messages/types'
import styles from './practicePreview.module.less'

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function PracticePreviewPage() {
  const { practiceId } = useParams<{ practiceId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [practiceName, setPracticeName] = useState('')
  const [groupedMessages, setGroupedMessages] = useState<MessageGroup[]>([])

  useEffect(() => {
    if (!practiceId) {
      setError('未找到实践ID')
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadPractice() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetchCommands()
        if (cancelled) return

        const practice = (response.data.best_practices || []).find((p) => p.id === practiceId)

        if (!practice) {
          setError('未找到该最佳实践')
          setLoading(false)
          return
        }

        setPracticeName(practice.name)

        // 转换 API messages 为 LegacyChatMessage 格式
        const apiMessages = Array.isArray(practice.messages) ? practice.messages : []
        const messages: LegacyChatMessage[] = apiMessages.map((msg: any, index) => ({
          id: `msg-${index}`,
          role: msg.role as 'user' | 'assistant',
          content: msg.content || '',
          timestamp: formatTime(new Date()),
          loading: false,
          toolCalls: [],
          references: [],
          courses: [],
          skillOutput: [],
          uploadedFiles: (msg.attachments || []).map((a: any, i: number) => ({
            id: `att-${a.resource_id || i}`,
            name: a.file_name || '附件',
            size: 0,
            ext: a.file_name?.split('.').pop() || '',
            url: a.url || '',
          })),
        }))

        const adaptedMessages = adaptChatMessages(messages)
        const grouped = groupMessages(adaptedMessages)
        setGroupedMessages(grouped)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPractice()

    return () => {
      cancelled = true
    }
  }, [practiceId])

  const handleBack = () => {
    navigate('/')
  }

  if (loading) {
    return (
      <AppPageShell className={styles.page}>
        <AppSurfacePanel className={styles.panel}>
          <div className={styles.loading}>加载中...</div>
        </AppSurfacePanel>
      </AppPageShell>
    )
  }

  if (error) {
    return (
      <AppPageShell className={styles.page}>
        <AppSurfacePanel className={styles.panel}>
          <div className={styles.error}>{error}</div>
          <div className={styles.footer}>
            <button type="button" className={styles.backButton} onClick={handleBack}>
              返回首页
            </button>
          </div>
        </AppSurfacePanel>
      </AppPageShell>
    )
  }

  return (
    <AppPageShell className={styles.page}>
      <AppSurfacePanel className={styles.panel}>
        <header className={styles.header}>
          <h1>{practiceName}</h1>
        </header>

        <div className={styles.messages}>
          <div className={styles.messageColumn}>
            <MessageList
              groups={groupedMessages}
              threadLoading={false}
              copiedMessageId={null}
              assistantCopyTargets={{}}
              onCopy={() => {}}
              getToolDisplayTitle={() => ''}
              getToolDisplaySummary={() => ''}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.createButton} onClick={handleBack}>
            <span>立即创作</span>
          </button>
          <div className={styles.hint}>AI 生成内容可能有误，请核实重要信息</div>
        </div>
      </AppSurfacePanel>
    </AppPageShell>
  )
}
