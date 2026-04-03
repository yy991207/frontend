type StreamMessageLike = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  loading?: boolean
  sessionId?: string
  toolCalls?: unknown[]
  references?: unknown[]
  courses?: unknown[]
  skillOutput?: unknown[]
}

type AppendTextDeltaResult<TMessage extends StreamMessageLike> = {
  messages: TMessage[]
  activeMessageId: string
}

function hasProcessingSteps(message: StreamMessageLike): boolean {
  return (message.toolCalls?.length ?? 0) > 0 || (message.courses?.length ?? 0) > 0
}

function buildFollowupMessageId(messages: StreamMessageLike[], activeMessageId: string): string {
  const prefix = `${activeMessageId}-followup-`
  const existingCount = messages.filter((message) => message.id.startsWith(prefix)).length
  return `${prefix}${existingCount + 1}`
}

export function appendTextDeltaToStreamMessages<TMessage extends StreamMessageLike>(
  messages: TMessage[],
  activeMessageId: string,
  chunk: string,
  timestamp: string,
  createFollowupMessage?: (baseMessage: TMessage, nextMessageId: string, nextTimestamp: string) => TMessage,
): AppendTextDeltaResult<TMessage> {
  const activeIndex = messages.findIndex((message) => message.id === activeMessageId)

  if (activeIndex === -1) {
    return {
      messages,
      activeMessageId,
    }
  }

  const activeMessage = messages[activeIndex]

  if (activeMessage.role !== 'assistant') {
    return {
      messages,
      activeMessageId,
    }
  }

  if (!hasProcessingSteps(activeMessage)) {
    return {
      messages: messages.map((message, index) =>
        index === activeIndex
          ? {
              ...message,
              content: `${message.content}${chunk}`,
              timestamp,
              loading: false,
            }
          : message,
      ),
      activeMessageId,
    }
  }

  const followupMessageId = buildFollowupMessageId(messages, activeMessageId)
  const followupMessage = createFollowupMessage
    ? createFollowupMessage(activeMessage, followupMessageId, timestamp)
    : {
        ...activeMessage,
        id: followupMessageId,
        content: '',
        timestamp,
        loading: true,
        toolCalls: [],
        references: [],
        courses: [],
        skillOutput: [],
      }

  return {
    messages: [
      ...messages.slice(0, activeIndex + 1),
      {
        ...followupMessage,
        content: `${followupMessage.content}${chunk}`,
        timestamp,
        loading: false,
      },
      ...messages.slice(activeIndex + 1),
    ],
    activeMessageId: followupMessageId,
  }
}
