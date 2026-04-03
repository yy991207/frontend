import type {
  LegacyChatMessage,
  Message,
  MessageAdditionalKwargs,
} from './types'

function buildAdditionalKwargs(message: LegacyChatMessage): MessageAdditionalKwargs {
  const nextAdditionalKwargs: MessageAdditionalKwargs = {}

  if (message.reasoningContent) {
    nextAdditionalKwargs.reasoning_content = message.reasoningContent
  }

  if (message.subagentLabel) {
    nextAdditionalKwargs.subagent_label = message.subagentLabel
  }

  return nextAdditionalKwargs
}

export function adaptChatMessage(message: LegacyChatMessage): Message {
  return {
    id: message.id,
    type: message.role === 'user' ? 'human' : 'ai',
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    loading: Boolean(message.loading),
    sessionId: message.sessionId,
    tool_calls: [...(message.toolCalls ?? [])],
    references: [...(message.references ?? [])],
    courses: [...(message.courses ?? [])],
    additional_kwargs: buildAdditionalKwargs(message),
  }
}

export function adaptChatMessages(messages: LegacyChatMessage[]): Message[] {
  return messages.map(adaptChatMessage)
}
