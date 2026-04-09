export type CustomAgentApiConfig = {
  userId: string
  baseUrl: string
  createAgentEndpoint: string
  listAgentEndpoint: string
  viewAgentEndpoint: string
  updateAgentEndpoint: string
  chatAgentEndpoint: string
}

export type PresetQuestion = {
  category: string
  question: string
}

export type CreateCustomAgentPayload = {
  agent_name: string
  agent_prompt: string
  avatar_url: string
  description: string
  enabled_skills: string[]
  is_public: boolean
  preset_questions: PresetQuestion[]
  resource_ids: string[]
  user_id: string
}

type CreateCustomAgentResponse = {
  success?: boolean
  message?: string
  data?: {
    agent_id?: string
  }
}

export type CustomAgentItem = {
  agent_id: string
  creator_user_id: string
  agent_name: string
  description: string
  avatar_url: string
  is_active: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

type ListCustomAgentResponse = {
  success?: boolean
  code?: number
  msg?: string
  data?: {
    agents: CustomAgentItem[]
    total: number
  }
}

function parseSimpleYaml(rawText: string) {
  return rawText.split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
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

function buildAbsoluteUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export async function loadCustomAgentApiConfig(): Promise<CustomAgentApiConfig> {
  const response = await fetch('/config.yaml')

  if (!response.ok) {
    throw new Error('加载配置文件失败')
  }

  const rawText = await response.text()
  const parsedConfig = parseSimpleYaml(rawText)

  const baseUrl = parsedConfig.url
  const createAgentPath = parsedConfig.create_custom_agent_path
  const listAgentPath = parsedConfig.list_custom_agent_path
  const viewAgentPath = parsedConfig.view_custom_agent_path
  const updateAgentPath = parsedConfig.update_custom_agent_path
  const chatAgentPath = parsedConfig.chat_custom_agent_path
  const userId = parsedConfig.user_id

  if (!baseUrl || !createAgentPath || !listAgentPath || !viewAgentPath || !updateAgentPath || !chatAgentPath || !userId) {
    throw new Error('config.yaml 缺少必要的接口配置')
  }

  return {
    userId,
    baseUrl,
    createAgentEndpoint: buildAbsoluteUrl(baseUrl, createAgentPath),
    listAgentEndpoint: buildAbsoluteUrl(baseUrl, listAgentPath),
    viewAgentEndpoint: buildAbsoluteUrl(baseUrl, viewAgentPath),
    updateAgentEndpoint: buildAbsoluteUrl(baseUrl, updateAgentPath),
    chatAgentEndpoint: buildAbsoluteUrl(baseUrl, chatAgentPath),
  }
}

export async function createCustomAgent(
  config: CustomAgentApiConfig,
  payload: Omit<CreateCustomAgentPayload, 'user_id'>,
  signal?: AbortSignal,
): Promise<CreateCustomAgentResponse> {
  const requestUrl = new URL(config.createAgentEndpoint)
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    throw new Error(`发布失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as CreateCustomAgentResponse

  return data
}

export async function listCustomAgents(
  config: CustomAgentApiConfig,
  signal?: AbortSignal,
): Promise<CustomAgentItem[]> {
  const requestUrl = new URL(config.listAgentEndpoint)
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`获取智能体列表失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as ListCustomAgentResponse

  if (!data.success) {
    throw new Error(data.msg || '获取智能体列表失败')
  }

  return data.data?.agents || []
}

export type EnabledSkill = {
  skill_name: string
  chinese_name: string
  description: string
  template?: string
}

export type AgentDetail = {
  agent_id: string
  creator_user_id: string
  agent_name: string
  description: string
  avatar_url: string
  agent_prompt: string
  enabled_skills: EnabledSkill[]
  resource_ids: string[]
  preset_questions: PresetQuestion[]
  is_active: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

type ViewCustomAgentResponse = {
  success?: boolean
  code?: number
  msg?: string
  data?: {
    agent: AgentDetail
    skills: unknown[]
    preset_questions: PresetQuestion[]
  }
}

export async function viewCustomAgent(
  config: CustomAgentApiConfig,
  agentId: string,
  signal?: AbortSignal,
): Promise<AgentDetail> {
  const requestUrl = new URL(config.viewAgentEndpoint.replace('{agent_id}', agentId))
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`获取智能体详情失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as ViewCustomAgentResponse

  if (!data.success) {
    throw new Error(data.msg || '获取智能体详情失败')
  }

  return data.data?.agent as AgentDetail
}

export type UpdateCustomAgentPayload = {
  agent_name?: string
  description?: string
  avatar_url?: string
  agent_prompt?: string
  enabled_skills?: { skill_name: string }[]
  preset_questions?: PresetQuestion[]
  resource_ids?: string[]
  is_public?: boolean
  is_active?: boolean
}

type UpdateCustomAgentResponse = {
  success?: boolean
  code?: number
  msg?: string
  data?: {
    agent: AgentDetail
  } | null
}

export async function updateCustomAgent(
  config: CustomAgentApiConfig,
  agentId: string,
  payload: UpdateCustomAgentPayload,
  signal?: AbortSignal,
): Promise<AgentDetail | null> {
  const requestUrl = new URL(config.updateAgentEndpoint.replace('{agent_id}', agentId))
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    throw new Error(`更新智能体失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as UpdateCustomAgentResponse

  if (!data.success) {
    throw new Error(data.msg || '更新智能体失败')
  }

  return data.data?.agent ?? null
}

// 聊天流式请求相关类型
export type ChatMessageItem = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatAgentRequest = {
  agent_name: string
  agent_prompt: string
  description: string
  message: string
  history: ChatMessageItem[]
  enabled_skills: { skill_name: string; chinese_name?: string; description?: string }[]
  resource_ids: string[]
  user_id: string
  enable_web_search?: boolean
}

// SSE事件类型
export type SseEvent = {
  event?: string
  data?: string
  id?: string
}

// 解析SSE事件
function parseSseEvent(line: string): SseEvent | null {
  if (line.startsWith('event:')) {
    return { event: line.slice(6).trim() }
  }
  if (line.startsWith('data:')) {
    return { data: line.slice(5).trim() }
  }
  if (line.startsWith('id:')) {
    return { id: line.slice(3).trim() }
  }
  return null
}

// 流式聊天请求
export async function chatCustomAgentStream(
  config: CustomAgentApiConfig,
  payload: Omit<ChatAgentRequest, 'user_id'>,
  signal: AbortSignal,
  callbacks: {
    onChatModelStart?: () => void
    onTextDelta?: (text: string) => void
    onReasoningDelta?: (text: string) => void
    onThinking?: (thinking: { label: string; status: 'running' | 'complete'; results?: string[] }) => void
    onToolCall?: (toolCall: { name: string; status: 'running' | 'completed'; input?: unknown; output?: unknown }) => void
    onComplete?: () => void
    onError?: (error: Error) => void
  },
): Promise<void> {
  const requestUrl = new URL(config.chatAgentEndpoint)
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      ...payload,
      user_id: config.userId,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`聊天请求失败: HTTP ${response.status} ${errorText}`)
  }

  if (!response.body) {
    throw new Error('响应体为空')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        callbacks.onComplete?.()
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        
        // 解析SSE事件
        if (trimmedLine.startsWith('event:')) {
          currentEvent = trimmedLine.slice(6).trim()
          continue
        }
        
        if (trimmedLine.startsWith('data:')) {
          const dataStr = trimmedLine.slice(5).trim()
          
          // 处理空数据行（事件分隔符）
          if (!dataStr) {
            currentEvent = ''
            continue
          }
          
          try {
            const data = JSON.parse(dataStr)
            
            // 处理 done 事件
            if (currentEvent === 'done') {
              callbacks.onComplete?.()
              return
            }
            
            // 处理 on_chat_model_start 事件（标记新一轮模型输出开始）
            if (currentEvent === 'on_chat_model_start') {
              callbacks.onChatModelStart?.()
            }
            
            // 处理 on_chat_model_stream 事件
            if (currentEvent === 'on_chat_model_stream' && data.data?.chunk) {
              const chunk = data.data.chunk
              
              // 处理 reasoning_content（思考过程）
              if (chunk.reasoning_content) {
                callbacks.onReasoningDelta?.(chunk.reasoning_content)
              }
              
              // 处理 content（正式回复）
              if (chunk.content) {
                callbacks.onTextDelta?.(chunk.content)
              }
            }
            
            // 处理 on_tool_start 事件
            if (currentEvent === 'on_tool_start' && data.data?.input) {
              callbacks.onToolCall?.({
                name: data.name,
                status: 'running',
                input: data.data.input,
              })
            }
            
            // 处理 on_tool_end 事件
            if (currentEvent === 'on_tool_end' && data.data?.output) {
              const toolDisplay = data.data.tool_display
              callbacks.onToolCall?.({
                name: data.name,
                status: 'completed',
                input: data.data.input,
                output: {
                  text: data.data.output,
                  tool_display: toolDisplay,
                },
              })
            }
            
            // 处理 on_chain_end 事件（仅用于标记完成，不输出content避免重复）
            // content 已经在 on_chat_model_stream 中完整输出
          } catch (e) {
            // 忽略解析错误
            console.warn('SSE data parse error:', e)
          }
        }
      }
    }
  } catch (error) {
    if (signal.aborted) {
      return
    }
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
  }
}
