export type ChatApiConfig = {
  userId: string
  createSessionEndpoint: string
  streamEndpointBase: string
}

const DEFAULT_CHAT_API_CONFIG: ChatApiConfig = {
  userId: '123456',
  createSessionEndpoint: 'http://192.168.30.238:8000/api/v1/chat/sessions',
  streamEndpointBase: 'http://192.168.30.238:8000/api/v1/chat/sessions',
}

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

type SessionResponse = Record<string, unknown> & {
  session_id?: string
  data?: {
    session_id?: string
  }
}

type StreamPayload = {
  message: string
  tool_type?: string | null
}

export type SkillOutputItem = {
  skill_name: string
  type: string
  filename: string
  url: string
  size: number
}

type ReadSseStreamOptions = {
  onTextDelta?: (chunk: string) => void
  onToolStart?: (toolCall: ToolCall) => void
  onToolEnd?: (toolCall: ToolCall) => void
  onReferences?: (references: ChatReference[]) => void
  onSkillOutput?: (skillOutput: SkillOutputItem[]) => void
}

type CreateSessionResult = {
  sessionId: string
}

type ToolStartEvent = {
  name?: string
  run_id?: string
  data?: {
    input?: Record<string, unknown>
  }
}

type ToolEndEvent = {
  name?: string
  run_id?: string
  data?: {
    output?: unknown
    tool_display?: Record<string, unknown>
  }
}

type ChainEndEvent = {
  data?: {
    references?: unknown
    skill_output?: unknown
  }
}

function parseSimpleYaml(rawText: string) {
  return rawText.split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return result
    }

    const separatorIndex = trimmedLine.indexOf(':')

    if (separatorIndex === -1) {
      return result
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

    if (key) {
      result[key] = value
    }

    return result
  }, {})
}

export function parseChatApiConfig(rawText: string): ChatApiConfig {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url || new URL(DEFAULT_CHAT_API_CONFIG.createSessionEndpoint).origin
  const userId = parsedConfig.user_id || DEFAULT_CHAT_API_CONFIG.userId

  if (!baseUrl || !userId) {
    throw new Error('config.yaml 缺少 url 或 user_id 配置')
  }

  const createChatSessionPath = parsedConfig.create_chat_session_path || '/api/v1/chat/sessions'
  const sessionBaseUrl = new URL(createChatSessionPath, baseUrl).toString()

  return {
    userId,
    createSessionEndpoint: sessionBaseUrl,
    streamEndpointBase: sessionBaseUrl,
  }
}

export function extractSessionId(response: SessionResponse): string {
  const sessionId = response.session_id ?? response.data?.session_id

  if (!sessionId) {
    throw new Error('会话创建成功但未返回 session_id')
  }

  return sessionId
}

export async function createChatSession(config: ChatApiConfig, signal?: AbortSignal): Promise<CreateSessionResult> {
  const response = await fetch(config.createSessionEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      user_id: config.userId,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error('创建会话失败')
  }

  const data = (await response.json()) as SessionResponse

  return {
    sessionId: extractSessionId(data),
  }
}

export function buildChatPagePath(sessionId: string): string {
  return `/chat?sessionId=${encodeURIComponent(sessionId)}`
}

export async function createNewChatPagePath(rawConfigText: string, signal?: AbortSignal): Promise<string> {
  const config = parseChatApiConfig(rawConfigText)
  const { sessionId } = await createChatSession(config, signal)
  return buildChatPagePath(sessionId)
}

export async function streamChatMessage(
  config: ChatApiConfig,
  sessionId: string,
  payload: StreamPayload,
  signal?: AbortSignal,
) {
  const response = await fetch(`${config.streamEndpointBase}/${sessionId}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      tool_type: payload.tool_type ?? null,
      message: payload.message,
    }),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error('流式响应失败')
  }

  return response.body
}

export async function downloadSessionFileContent(
  config: ChatApiConfig,
  sessionId: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const requestUrl = new URL(`${config.streamEndpointBase}/${sessionId}/files/download`)
  requestUrl.searchParams.set('path', filePath)
  requestUrl.searchParams.set('mode', 'inline')

  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error('课程文件下载失败')
  }

  return response.text()
}

export function resolveQuickActionToolType(prompt: string): string | null {
  const normalizedPrompt = prompt.trim()

  if (!normalizedPrompt) {
    return null
  }

  if (normalizedPrompt.includes('课表') || normalizedPrompt.includes('课程')) {
    return 'explore'
  }

  return null
}

export function extractReferences(eventObj: ChainEndEvent): ChatReference[] {
  const references = eventObj.data?.references

  if (!Array.isArray(references)) {
    return []
  }

  return references.filter((item): item is ChatReference => typeof item === 'object' && item !== null)
}

export function extractSkillOutput(eventObj: ChainEndEvent): SkillOutputItem[] {
  const skillOutput = eventObj.data?.skill_output

  if (!Array.isArray(skillOutput)) {
    return []
  }

  return skillOutput.filter(
    (item): item is SkillOutputItem =>
      typeof item === 'object' && item !== null && typeof (item as { url?: unknown }).url === 'string',
  )
}

export function extractCourseTableFilePath(toolCall: Pick<ToolCall, 'input'>): string | null {
  const filePath = toolCall.input.file_path

  if (typeof filePath !== 'string') {
    return null
  }

  return filePath.endsWith('course_table.json') ? filePath : null
}

export function parseCourseTableContent(rawContent: string): CourseItem[] {
  const normalizedContent = rawContent
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  let parsedData: unknown

  try {
    parsedData = JSON.parse(normalizedContent)
  } catch {
    return []
  }

  const rawCourses = Array.isArray(parsedData)
    ? parsedData
    : typeof parsedData === 'object' && parsedData !== null && Array.isArray((parsedData as { courses?: unknown[] }).courses)
      ? (parsedData as { courses: unknown[] }).courses
      : []

  return rawCourses.flatMap((course) => {
    if (typeof course !== 'object' || course === null) {
      return []
    }

    const item = course as Record<string, unknown>

    if (typeof item.title !== 'string' || !item.title.trim()) {
      return []
    }

    return [{
      title: item.title,
      description: typeof item.description === 'string' ? item.description : undefined,
      duration: typeof item.duration === 'string' ? item.duration : undefined,
      resourceId: typeof item.resource_id === 'string' ? item.resource_id : undefined,
      url: typeof item.url === 'string' ? item.url : undefined,
    }]
  })
}

export async function readSseStream(stream: ReadableStream<Uint8Array>, options: ReadSseStreamOptions) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  const flushLine = (line: string) => {
    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim()
      return
    }

    if (!line.startsWith('data:')) {
      return
    }

    const rawData = line.slice(5).trim()

    if (!rawData) {
      return
    }

    let parsedData: unknown

    try {
      parsedData = JSON.parse(rawData)
    } catch {
      return
    }

    if (currentEvent === 'on_tool_start') {
      const eventObj = parsedData as ToolStartEvent

      if (eventObj.name && eventObj.run_id) {
        options.onToolStart?.({
          name: eventObj.name,
          runId: eventObj.run_id,
          status: 'running',
          input: eventObj.data?.input ?? {},
        })
      }

      return
    }

    if (currentEvent === 'on_tool_end') {
      const eventObj = parsedData as ToolEndEvent

      if (eventObj.name && eventObj.run_id) {
        options.onToolEnd?.({
          name: eventObj.name,
          runId: eventObj.run_id,
          status: 'completed',
          input: {},
          output: eventObj.data?.output,
          toolDisplay: eventObj.data?.tool_display,
        })
      }

      return
    }

    if (currentEvent === 'on_chain_end') {
      const chainEndEvent = parsedData as ChainEndEvent
      options.onReferences?.(extractReferences(chainEndEvent))
      options.onSkillOutput?.(extractSkillOutput(chainEndEvent))
      return
    }

    if (currentEvent !== 'on_chat_model_stream') {
      return
    }

    const chunk =
      typeof parsedData === 'object' && parsedData !== null
        ? (parsedData as { data?: { chunk?: { content?: string } } }).data?.chunk?.content
        : undefined

    if (chunk) {
      options.onTextDelta?.(chunk)
    }
  }

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) {
        currentEvent = ''
        continue
      }

      flushLine(line)
    }
  }

  const remaining = buffer.trim()

  if (remaining) {
    flushLine(remaining)
  }
}
