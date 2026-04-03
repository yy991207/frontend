export type ToolCall = {
  name: string
  runId: string
  status: 'running' | 'completed'
  input: Record<string, unknown>
  output?: unknown
  toolDisplay?: Record<string, unknown>
}

export type ChatReference = {
  title?: string
  url?: string
}

export type CourseItem = {
  title: string
  description?: string
  duration?: string
  resourceId?: string
  url?: string
}

export type LegacyChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  loading?: boolean
  sessionId?: string
  toolCalls?: ToolCall[]
  references?: ChatReference[]
  courses?: CourseItem[]
  reasoningContent?: string | null
  subagentLabel?: string | null
}

export type ContentBlock =
  | {
      type: 'text'
      text?: string
    }
  | {
      type: 'image_url'
      image_url?: {
        url: string
      }
    }

export type MessageAdditionalKwargs = Record<string, unknown> & {
  reasoning_content?: string | null
  subagent_label?: string | null
}

export type Message = {
  id: string
  type: 'human' | 'ai' | 'tool'
  role: 'user' | 'assistant' | 'tool'
  content: string | ContentBlock[]
  timestamp: string
  loading: boolean
  sessionId?: string
  tool_calls: ToolCall[]
  references: ChatReference[]
  courses: CourseItem[]
  additional_kwargs: MessageAdditionalKwargs
}

export type MessageGroup =
  | { type: 'human'; id: string; messages: Message[] }
  | { type: 'assistant:processing'; id: string; messages: Message[] }
  | { type: 'assistant:loading'; id: string; messages: Message[] }
  | { type: 'assistant:reasoning'; id: string; messages: Message[] }
  | { type: 'assistant:subagent'; id: string; messages: Message[] }
  | { type: 'assistant'; id: string; messages: Message[] }
