import type { MessageGroup, ToolCall } from '../../core/messages/types'
import styles from '../../pages/Chat/chat.module.less'

import { MessageGroupSection } from './message-group'

function MessageListSkeleton() {
  const assistantLineClasses = [
    styles.messageSkeletonBarFull,
    styles.messageSkeletonBarFull,
    styles.messageSkeletonBarMedium,
    styles.messageSkeletonBarFull,
    styles.messageSkeletonBarLong,
    styles.messageSkeletonBarMedium,
    styles.messageSkeletonBarShort,
  ]

  return (
    <div className={styles.messageListSkeleton} aria-label="正在加载会话消息">
      <div className={styles.messageSkeletonUser}>
        <span className={`${styles.messageSkeletonBar} ${styles.messageSkeletonBarMedium}`} />
        <span className={`${styles.messageSkeletonBar} ${styles.messageSkeletonBarShort}`} />
      </div>

      <div className={styles.messageSkeletonAssistant}>
        {assistantLineClasses.map((className, index) => (
          <span key={`${className}-${index}`} className={`${styles.messageSkeletonBar} ${className}`} />
        ))}
      </div>
    </div>
  )
}

type MessageListProps = {
  groups: MessageGroup[]
  threadLoading?: boolean
  copiedMessageId: string | null
  assistantCopyTargets: Record<string, string>
  onCopy: (messageId: string, content: string) => void
  getToolDisplayTitle: (toolCall: ToolCall) => string
  getToolDisplaySummary: (toolCall: ToolCall) => string
  onOpenFile?: (filepath: string, originalUrl?: string) => void
}

export function MessageList({
  groups,
  threadLoading = false,
  copiedMessageId,
  assistantCopyTargets,
  onCopy,
  getToolDisplayTitle,
  getToolDisplaySummary,
  onOpenFile,
}: MessageListProps) {
  if (threadLoading) {
    return <MessageListSkeleton />
  }

  return (
    <>
      {groups.map((group) => (
        <MessageGroupSection
          key={group.id}
          group={group}
          copiedMessageId={copiedMessageId}
          assistantCopyTargets={assistantCopyTargets}
          onCopy={onCopy}
          getToolDisplayTitle={getToolDisplayTitle}
          getToolDisplaySummary={getToolDisplaySummary}
          onOpenFile={onOpenFile}
        />
      ))}
    </>
  )
}
