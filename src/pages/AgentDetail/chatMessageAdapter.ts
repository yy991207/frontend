import type { LegacyChatMessage, Message, ToolCall } from '../../core/messages/types'
import { groupMessages, resolveAssistantCopyTargets } from '../../core/messages/utils'

export type AgentChatMessage = LegacyChatMessage

function cloneToolCall(toolCall: ToolCall): ToolCall {
  return {
    ...toolCall,
    input: toolCall.input ? { ...toolCall.input } : {},
  }
}

function cloneMessage(message: AgentChatMessage): AgentChatMessage {
  return {
    ...message,
    toolCalls: message.toolCalls?.map(cloneToolCall) ?? [],
    references: message.references ? [...message.references] : [],
    courses: message.courses ? [...message.courses] : [],
    skillOutput: message.skillOutput ? [...message.skillOutput] : [],
    reasoningContent: message.reasoningContent ?? null,
    subagentLabel: message.subagentLabel ?? null,
  }
}

export function getToolDisplayTitle(toolCall: ToolCall) {
  const label = typeof toolCall.toolDisplay?.tool_label === 'string' ? toolCall.toolDisplay.tool_label : ''
  return label || toolCall.name
}

export function getToolDisplaySummary(toolCall: ToolCall) {
  const items = Array.isArray(toolCall.toolDisplay?.items) ? toolCall.toolDisplay.items : []

  if (toolCall.status === 'running') {
    return '工具执行中...'
  }

  if (items.length > 0) {
    return `已返回 ${items.length} 条结果`
  }

  return '工具执行完成'
}

export function upsertToolCall(message: AgentChatMessage, nextToolCall: ToolCall): AgentChatMessage {
  const toolCalls = message.toolCalls ?? []
  const existingToolCall = toolCalls.find((item) => item.runId === nextToolCall.runId)

  if (!existingToolCall) {
    return {
      ...message,
      toolCalls: [...toolCalls, cloneToolCall(nextToolCall)],
    }
  }

  return {
    ...message,
    toolCalls: toolCalls.map((item) =>
      item.runId === nextToolCall.runId
        ? {
            ...item,
            ...nextToolCall,
            input: Object.keys(nextToolCall.input ?? {}).length ? { ...nextToolCall.input } : item.input,
          }
        : item,
    ),
  }
}

export function createUserMessage(content: string, timestamp: string, id = `user-${Date.now()}`): AgentChatMessage {
  return {
    id,
    role: 'user',
    content,
    timestamp,
  }
}

export function createLoadingAssistantMessage(timestamp: string, id = `assistant-${Date.now()}`): AgentChatMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    timestamp,
    loading: true,
    reasoningContent: null,
    toolCalls: [],
    references: [],
    courses: [],
    skillOutput: [],
    subagentLabel: null,
  }
}

export function createFollowupAssistantMessage(
  baseMessage: AgentChatMessage,
  nextMessageId: string,
  timestamp: string,
): AgentChatMessage {
  return {
    ...cloneMessage(baseMessage),
    id: nextMessageId,
    content: '',
    timestamp,
    loading: true,
    reasoningContent: null,
    toolCalls: [],
    references: [],
    courses: [],
    skillOutput: [],
    subagentLabel: null,
  }
}

export function updateAssistantMessageById(
  messages: AgentChatMessage[],
  messageId: string,
  updater: (message: AgentChatMessage) => AgentChatMessage,
): AgentChatMessage[] {
  return messages.map((message) => (message.id === messageId ? updater(message) : message))
}

export function advanceAssistantMessageForNextModelPhase(
  messages: AgentChatMessage[],
  activeMessageId: string,
  timestamp: string,
  createFollowup: typeof createFollowupAssistantMessage,
): { messages: AgentChatMessage[]; activeMessageId: string } {
  const activeMessage = messages.find((message) => message.id === activeMessageId)

  if (!activeMessage || activeMessage.role !== 'assistant') {
    return { messages, activeMessageId }
  }

  // 只要当前消息有任何输出（content、reasoning_content 或 toolCalls），就切分新消息
  // 这样每条 model phase 独立展示，groupMessages 能正确分组渲染
  const hasToolCalls = Boolean(activeMessage.toolCalls?.length)
  const hasText = Boolean(activeMessage.content.trim())
  const hasReasoning = Boolean(activeMessage.reasoningContent?.trim())

  if (!hasToolCalls && !hasText && !hasReasoning) {
    return { messages, activeMessageId }
  }

  const nextMessageId = `assistant-${Date.now()}-${messages.length}`
  const followupMessage = createFollowup(activeMessage, nextMessageId, timestamp)

  return {
    messages: [...messages, followupMessage],
    activeMessageId: nextMessageId,
  }
}

export function appendTextDeltaToStreamMessages(
  messages: AgentChatMessage[],
  activeMessageId: string,
  chunk: string,
  timestamp: string,
  createFollowup: typeof createFollowupAssistantMessage,
): { messages: AgentChatMessage[]; activeMessageId: string } {
  const activeMessage = messages.find((message) => message.id === activeMessageId)

  if (!activeMessage || activeMessage.role !== 'assistant') {
    return { messages, activeMessageId }
  }

  let nextActiveMessageId = activeMessageId
  let nextMessages = messages

  if (activeMessage.toolCalls?.length && activeMessage.content.trim()) {
    const advanced = advanceAssistantMessageForNextModelPhase(messages, activeMessageId, timestamp, createFollowup)
    nextMessages = advanced.messages
    nextActiveMessageId = advanced.activeMessageId
  }

  return {
    activeMessageId: nextActiveMessageId,
    messages: updateAssistantMessageById(nextMessages, nextActiveMessageId, (message) => ({
      ...message,
      content: `${message.content}${chunk}`,
      timestamp,
    })),
  }
}

export function buildMessageGroups(messages: AgentChatMessage[]) {
  return groupMessages(toMessageList(messages))
}

export function buildAssistantCopyTargets(messages: AgentChatMessage[]) {
  return resolveAssistantCopyTargets(toMessageList(messages))
}

export function toMessageList(messages: AgentChatMessage[]): Message[] {
  return messages.map((message) => ({
    id: message.id,
    type: message.role === 'user' ? 'human' : 'ai',
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    loading: Boolean(message.loading),
    sessionId: message.sessionId,
    tool_calls: message.toolCalls ?? [],
    references: message.references ?? [],
    courses: message.courses ?? [],
    skillOutput: message.skillOutput ?? [],
    additional_kwargs: {
      reasoning_content: message.reasoningContent ?? null,
      subagent_label: message.subagentLabel ?? null,
    },
  }))
}
