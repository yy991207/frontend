export type CustomAgentApiConfig = {
  userId: string
  baseUrl: string
  createAgentEndpoint: string
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
  const userId = parsedConfig.user_id

  if (!baseUrl || !createAgentPath || !userId) {
    throw new Error('config.yaml 缺少 url、create_custom_agent_path 或 user_id 配置')
  }

  return {
    userId,
    baseUrl,
    createAgentEndpoint: buildAbsoluteUrl(baseUrl, createAgentPath),
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
