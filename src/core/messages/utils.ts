import type { ContentBlock, Message, MessageGroup, SkillOutputItem } from './types'

export function extractTextFromMessage(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content.trim()
  }

  return message.content
    .map((block) => (block.type === 'text' ? block.text ?? '' : ''))
    .join('\n')
    .trim()
}

function stripSkillOutputUrlsFromText(text: string, skillOutput: SkillOutputItem[]): string {
  let result = text

  for (const item of skillOutput) {
    const escapedUrl = item.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const urlPattern = new RegExp(escapedUrl, 'g')
    const markdownLinkPattern = new RegExp(`\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g')

    result = result.replace(urlPattern, '')
    result = result.replace(markdownLinkPattern, '$1')
  }

  return result.replace(/\n{3,}/g, '\n\n').trim()
}

export function extractAssistantOutputText(message: Message): string {
  const text = extractTextFromMessage(message)

  if (!message.skillOutput.length) {
    return text
  }

  return stripSkillOutputUrlsFromText(text, message.skillOutput)
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

    if (shouldRenderProcessing) {
      groups.push({
        id: `${message.id}-processing`,
        type: 'assistant:processing',
        messages: [message],
      })
    }

    // think / 工具步骤在流式里先于最终正文出现，这里统一让 processing 先渲染，再渲染 assistant 正文。
    if (shouldRenderAssistantOutput) {
      groups.push({
        id: `${message.id}-assistant`,
        type: 'assistant',
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

export function resolveAssistantCopyTargets(
  messages: Message[],
  options?: { excludeLastTurn?: boolean },
): Record<string, string> {
  const targets: Record<string, string> = {}
  let currentTurnLastMessageId: string | null = null
  let currentTurnTextParts: string[] = []

  const finalizeCurrentTurn = () => {
    if (!currentTurnLastMessageId || !currentTurnTextParts.length) {
      currentTurnLastMessageId = null
      currentTurnTextParts = []
      return
    }

    targets[currentTurnLastMessageId] = currentTurnTextParts.join('\n\n').trim()
    currentTurnLastMessageId = null
    currentTurnTextParts = []
  }

  for (const message of messages) {
    if (message.type === 'human' || message.role === 'user') {
      finalizeCurrentTurn()
      continue
    }

    const text = extractAssistantOutputText(message)

    if (!text) {
      continue
    }

    currentTurnLastMessageId = message.id
    currentTurnTextParts.push(text)
  }

  if (!options?.excludeLastTurn) {
    finalizeCurrentTurn()
  }

  return targets
}
