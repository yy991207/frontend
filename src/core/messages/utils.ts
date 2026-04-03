import type { ContentBlock, Message, MessageGroup } from './types'

export function extractTextFromMessage(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content.trim()
  }

  return message.content
    .map((block) => (block.type === 'text' ? block.text ?? '' : ''))
    .join('\n')
    .trim()
}

export function extractContentFromMessage(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content.trim()
  }

  return message.content
    .map((block) => {
      if (block.type === 'text') {
        return block.text ?? ''
      }

      return `![image](${block.image_url?.url ?? ''})`
    })
    .join('\n')
    .trim()
}

export function extractReasoningContentFromMessage(message: Message): string | null {
  const reasoningContent = message.additional_kwargs.reasoning_content
  return typeof reasoningContent === 'string' && reasoningContent.trim() ? reasoningContent : null
}

export function extractSubagentLabelFromMessage(message: Message): string | null {
  const subagentLabel = message.additional_kwargs.subagent_label
  return typeof subagentLabel === 'string' && subagentLabel.trim() ? subagentLabel : null
}

function hasRenderableContentBlock(block: ContentBlock): boolean {
  if (block.type === 'text') {
    return Boolean(block.text?.trim())
  }

  return Boolean(block.image_url?.url)
}

export function hasContent(message: Message): boolean {
  if (typeof message.content === 'string') {
    return message.content.trim().length > 0
  }

  return message.content.some(hasRenderableContentBlock)
}

export function hasToolCalls(message: Message): boolean {
  return message.tool_calls.length > 0
}

export function hasReasoning(message: Message): boolean {
  return extractReasoningContentFromMessage(message) !== null
}

export function hasSubagent(message: Message): boolean {
  return extractSubagentLabelFromMessage(message) !== null
}

export function hasProcessingSteps(message: Message): boolean {
  return hasToolCalls(message) || hasReasoning(message) || hasSubagent(message) || message.courses.length > 0
}

export function hasLoadingPlaceholder(message: Message): boolean {
  return message.loading && !hasContent(message)
}

function mapGroup<T>(groups: MessageGroup[], mapper?: (group: MessageGroup) => T): Array<MessageGroup | T> {
  if (!mapper) {
    return groups
  }

  return groups
    .map(mapper)
    .filter((group) => group !== null && group !== undefined)
}

function mergeConsecutiveAssistantMessages(messages: Message[]): Message[] {
  const result: Message[] = []

  for (const message of messages) {
    if (message.type === 'human' || message.role === 'user') {
      result.push(message)
      continue
    }

    const last = result[result.length - 1]

    if (last && (last.type === 'ai' || last.role === 'assistant')) {
      last.tool_calls = [...last.tool_calls, ...message.tool_calls]
      last.courses = [...last.courses, ...message.courses]
      last.references = [...last.references, ...message.references]

      if (message.additional_kwargs.reasoning_content && !last.additional_kwargs.reasoning_content) {
        last.additional_kwargs.reasoning_content = message.additional_kwargs.reasoning_content
      }

      if (message.additional_kwargs.subagent_label && !last.additional_kwargs.subagent_label) {
        last.additional_kwargs.subagent_label = message.additional_kwargs.subagent_label
      }

      if (typeof message.content === 'string' && message.content.trim()) {
        if (typeof last.content === 'string') {
          last.content = last.content ? `${last.content}${message.content}` : message.content
        } else {
          last.content = message.content
        }
      }

      if (message.loading) {
        last.loading = true
      }
    } else {
      result.push({ ...message })
    }
  }

  return result
}

export function groupMessages(messages: Message[]): MessageGroup[]
export function groupMessages<T>(messages: Message[], mapper: (group: MessageGroup) => T): T[]
export function groupMessages<T>(messages: Message[], mapper?: (group: MessageGroup) => T): Array<MessageGroup | T> {
  const merged = mergeConsecutiveAssistantMessages(messages)

  if (!merged.length) {
    return []
  }

  const groups: MessageGroup[] = []

  for (const message of merged) {
    if (message.type === 'human' || message.role === 'user') {
      groups.push({
        id: message.id,
        type: 'human',
        messages: [message],
      })
      continue
    }

    // deer-flow 的处理过程是一个统一的步骤流，所以这里把 reasoning / tool / subagent / courses 合并成同一个 processing 组。
    if (hasProcessingSteps(message)) {
      groups.push({
        id: `${message.id}-processing`,
        type: 'assistant:processing',
        messages: [message],
      })
    }

    if (hasLoadingPlaceholder(message) && !hasProcessingSteps(message)) {
      groups.push({
        id: `${message.id}-loading`,
        type: 'assistant:loading',
        messages: [message],
      })
    }

    // 当消息同时有 processing steps 和正文时，正文由 ProcessingMessage 内部渲染，不再单独创建 assistant 组。
    if (hasContent(message) && !hasProcessingSteps(message)) {
      groups.push({
        id: `${message.id}-assistant`,
        type: 'assistant',
        messages: [message],
      })
    }
  }

  return mapGroup(groups, mapper)
}
