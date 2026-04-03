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

function hasAssistantOutput(message: Message): boolean {
  return hasContent(message) || message.skillOutput.length > 0
}

function mapGroup<T>(groups: MessageGroup[], mapper?: (group: MessageGroup) => T): Array<MessageGroup | T> {
  if (!mapper) {
    return groups
  }

  return groups
    .map(mapper)
    .filter((group) => group !== null && group !== undefined)
}

export function groupMessages(messages: Message[]): MessageGroup[]
export function groupMessages<T>(messages: Message[], mapper: (group: MessageGroup) => T): T[]
export function groupMessages<T>(messages: Message[], mapper?: (group: MessageGroup) => T): Array<MessageGroup | T> {
  const orderedMessages = messages.map((message) => ({ ...message }))

  if (!orderedMessages.length) {
    return []
  }

  const groups: MessageGroup[] = []

  for (const message of orderedMessages) {
    if (message.type === 'human' || message.role === 'user') {
      groups.push({
        id: message.id,
        type: 'human',
        messages: [message],
      })
      continue
    }

    const shouldRenderAssistantOutput = hasAssistantOutput(message)
    const shouldRenderProcessing = hasProcessingSteps(message)

    // 这里按真实交互顺序输出：同一条 assistant 里如果先有正文、后有工具步骤，前端也要先渲染正文，再渲染 processing。
    if (shouldRenderAssistantOutput) {
      groups.push({
        id: `${message.id}-assistant`,
        type: 'assistant',
        messages: [message],
      })
    }

    if (shouldRenderProcessing) {
      groups.push({
        id: `${message.id}-processing`,
        type: 'assistant:processing',
        messages: [message],
      })
    }

    if (hasLoadingPlaceholder(message) && !shouldRenderProcessing && !shouldRenderAssistantOutput) {
      groups.push({
        id: `${message.id}-loading`,
        type: 'assistant:loading',
        messages: [message],
      })
    }
  }

  return mapGroup(groups, mapper)
}
