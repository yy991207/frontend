import type { MessageGroup, ToolCall } from '../../core/messages/types'
import { ThreadLoading } from './ChatLoadingAnimation'
import { MessageGroupSection } from './message-group'

function MessageListSkeleton() {
  return <ThreadLoading />
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
