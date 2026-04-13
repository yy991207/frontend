import { readSseStream, type ChatReference, type SkillOutputItem, type ToolCall } from './chatService'

export type CustomAgentApiConfig = {
  userId: string
  baseUrl: string
  createAgentEndpoint: string
  listAgentEndpoint: string
  viewAgentEndpoint: string
  updateAgentEndpoint: string
  chatAgentEndpoint: string
  generateAgentTemplateEndpoint: string
  getAgentTemplateTaskEndpoint: string
  agentTemplatesEndpoint: string
  agentTemplateDetailEndpoint: string
  agentUsageLogsEndpoint: string
}

export type PresetQuestion = {
  category: string
  question: string
  instruction?: string
}

export type CreateCustomAgentPayload = {
  agent_name: string
  agent_prompt: string
  avatar_url: string
  description: string
  enable_web_search: boolean
  enabled_skills: EnabledSkill[]
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
  const generateTemplatePath = parsedConfig.generate_agent_template_path
  const getTemplateTaskPath = parsedConfig.get_agent_template_task_path
  const agentTemplatesPath = parsedConfig.agent_templates_path
  const agentTemplateDetailPath = parsedConfig.agent_template_detail_path
  const agentUsageLogsPath = parsedConfig.agent_usage_logs_path
  const userId = parsedConfig.user_id

  if (!baseUrl || !createAgentPath || !listAgentPath || !viewAgentPath || !updateAgentPath || !chatAgentPath || !generateTemplatePath || !getTemplateTaskPath || !agentTemplatesPath || !agentTemplateDetailPath || !agentUsageLogsPath || !userId) {
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
    generateAgentTemplateEndpoint: buildAbsoluteUrl(baseUrl, generateTemplatePath),
    getAgentTemplateTaskEndpoint: buildAbsoluteUrl(baseUrl, getTemplateTaskPath),
    agentTemplatesEndpoint: buildAbsoluteUrl(baseUrl, agentTemplatesPath),
    agentTemplateDetailEndpoint: buildAbsoluteUrl(baseUrl, agentTemplateDetailPath),
    agentUsageLogsEndpoint: buildAbsoluteUrl(baseUrl, agentUsageLogsPath),
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
  enable_web_search: boolean
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
  enable_web_search?: boolean
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

export async function chatCustomAgentStream(
  config: CustomAgentApiConfig,
  payload: Omit<ChatAgentRequest, 'user_id'>,
  signal: AbortSignal,
  callbacks: {
    onChatModelStart?: () => void
    onTextDelta?: (text: string) => void
    onReasoningDelta?: (text: string) => void
    onToolStart?: (toolCall: ToolCall) => void
    onToolEnd?: (toolCall: ToolCall) => void
    onReferences?: (references: ChatReference[]) => void
    onSkillOutput?: (skillOutput: SkillOutputItem[]) => void
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

  try {
    await readSseStream(response.body, {
      onChatModelStart: callbacks.onChatModelStart,
      onTextDelta: callbacks.onTextDelta,
      onReasoningDelta: callbacks.onReasoningDelta,
      onToolStart: callbacks.onToolStart,
      onToolEnd: callbacks.onToolEnd,
      onReferences: callbacks.onReferences,
      onSkillOutput: callbacks.onSkillOutput,
    })
    callbacks.onComplete?.()
  } catch (error) {
    if (signal.aborted) {
      return
    }
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
  }
}

export type GenerateAgentTemplateRequest = {
  input_text: string
}

export type GenerateAgentTemplateResponse = {
  success: boolean
  code: string
  msg: string
  data: {
    task_id: string
    status: string
  }
}

export type PresetQuestionGenerated = {
  question: string
  category: string
}

export type AgentTemplateTaskResult = {
  agent_name: string
  description: string
  agent_prompt: string
  preset_questions: PresetQuestionGenerated[]
}

export type AgentTemplateTaskResponse = {
  success: boolean
  code: string
  msg: string
  data: {
    task_id: string
    status: string
    progress: {
      agent_name: boolean
      description: boolean
      agent_prompt: boolean
      preset_questions: boolean
    }
    is_completed: boolean
    result: AgentTemplateTaskResult | null
    error: string | null
  }
}

export async function generateAgentTemplate(
  config: CustomAgentApiConfig,
  inputText: string,
  signal?: AbortSignal,
): Promise<GenerateAgentTemplateResponse> {
  const requestUrl = new URL(config.generateAgentTemplateEndpoint)
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ input_text: inputText }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`生成智能体模板失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as GenerateAgentTemplateResponse
  return data
}

export async function getAgentTemplateTask(
  config: CustomAgentApiConfig,
  taskId: string,
  signal?: AbortSignal,
): Promise<AgentTemplateTaskResponse> {
  const requestUrl = new URL(config.getAgentTemplateTaskEndpoint.replace('{task_id}', taskId))
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`获取模板任务状态失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as AgentTemplateTaskResponse
  return data
}

export type AgentTemplateItem = {
  template_id: string
  template_name: string
  description: string
  avatar_url: string | null
  category: string
  sort_order: number
}

type AgentTemplatesResponse = {
  success: boolean
  code: string
  msg: string
  data: {
    templates: AgentTemplateItem[]
    total: number
  }
}

export async function getAgentTemplates(
  config: CustomAgentApiConfig,
  signal?: AbortSignal,
): Promise<AgentTemplateItem[]> {
  const response = await fetch(config.agentTemplatesEndpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`获取智能体模版列表失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as AgentTemplatesResponse

  if (!data.success) {
    throw new Error(data.msg || '获取智能体模版列表失败')
  }

  return data.data?.templates || []
}

export type PresetQuestionTemplate = {
  question: string
  instruction?: string
}

export type AgentTemplateDetail = {
  template_id: string
  template_name: string
  description: string
  avatar_url: string | null
  agent_prompt: string
  enabled_skills: EnabledSkill[]
  resource_ids: string[]
  preset_questions: PresetQuestionTemplate[]
  enable_web_search: boolean
  is_public: boolean
  category: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type AgentTemplateDetailResponse = {
  success: boolean
  code: string
  msg: string
  data: {
    template: AgentTemplateDetail
  }
}

export async function getAgentTemplateDetail(
  config: CustomAgentApiConfig,
  templateId: string,
  signal?: AbortSignal,
): Promise<AgentTemplateDetail> {
  const requestUrl = config.agentTemplateDetailEndpoint.replace('{template_id}', templateId)

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`获取智能体模版详情失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as AgentTemplateDetailResponse

  if (!data.success) {
    throw new Error(data.msg || '获取智能体模版详情失败')
  }

  return data.data?.template
}

export type AgentUsageLogItem = {
  agent_id: string
  user_id: string
  agent_name: string
  avatar_url: string
  used_at: string
}

type AgentUsageLogsResponse = {
  success: boolean
  code: string
  msg: string
  data: {
    logs: AgentUsageLogItem[]
  }
}

export async function getAgentUsageLogs(
  config: CustomAgentApiConfig,
  signal?: AbortSignal,
): Promise<AgentUsageLogItem[]> {
  const requestUrl = new URL(config.agentUsageLogsEndpoint)
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`获取智能体使用日志失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as AgentUsageLogsResponse

  if (!data.success) {
    throw new Error(data.msg || '获取智能体使用日志失败')
  }

  const logs = data.data?.logs || []
  return logs.sort((a, b) => new Date(b.used_at).getTime() - new Date(a.used_at).getTime())
}
