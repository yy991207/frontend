import type { MessageGroup, ToolCall } from '../../core/messages/types'

import { MessageGroupSection } from './message-group'

type MessageListProps = {
  groups: MessageGroup[]
  copiedMessageId: string | null
  onCopy: (messageId: string, content: string) => void
  getToolDisplayTitle: (toolCall: ToolCall) => string
  getToolDisplaySummary: (toolCall: ToolCall) => string
  onOpenFile?: (filepath: string, originalUrl?: string) => void
}

export function MessageList({
  groups,
  copiedMessageId,
  onCopy,
  getToolDisplayTitle,
  getToolDisplaySummary,
  onOpenFile,
}: MessageListProps) {
  return (
    <>
      {groups.map((group) => (
        <MessageGroupSection
          key={group.id}
          group={group}
          copiedMessageId={copiedMessageId}
          onCopy={onCopy}
          getToolDisplayTitle={getToolDisplayTitle}
          getToolDisplaySummary={getToolDisplaySummary}
          onOpenFile={onOpenFile}
        />
      ))}
    </>
  )
}
