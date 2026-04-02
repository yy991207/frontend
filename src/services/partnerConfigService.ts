export type PartnerApiConfig = {
  userId: string
  viewConfigEndpoint: string
}

export type PartnerConfig = {
  agentName: string
  avatarUrl: string
  soulContent: string
  userContent: string
  identityContent: string
}

type PartnerConfigResponse = {
  success?: boolean
  data?: {
    agent?: {
      agent_name?: string
      avatar_url?: string
    }
    memories?: Record<string, { content?: string }>
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

export function parsePartnerApiConfig(rawText: string): PartnerApiConfig {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const viewPartnerConfigPath = parsedConfig.view_partner_config_path
  const userId = parsedConfig.user_id

  if (!baseUrl || !viewPartnerConfigPath || !userId) {
    throw new Error('config.yaml 缺少 url、view_partner_config_path 或 user_id 配置')
  }

  return {
    userId,
    viewConfigEndpoint: buildAbsoluteUrl(baseUrl, viewPartnerConfigPath),
  }
}

export function extractPartnerConfig(response: PartnerConfigResponse): PartnerConfig {
  const agent = response.data?.agent
  const memories = response.data?.memories ?? {}

  return {
    agentName: agent?.agent_name ?? '',
    avatarUrl: agent?.avatar_url ?? '',
    soulContent: memories['SOUL.md']?.content ?? '',
    userContent: memories['USER.md']?.content ?? '',
    identityContent: memories['IDENTITY.md']?.content ?? '',
  }
}

export async function fetchPartnerConfig(config: PartnerApiConfig, signal?: AbortSignal): Promise<PartnerConfig> {
  const requestUrl = new URL(config.viewConfigEndpoint)
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), { signal })

  if (!response.ok) {
    throw new Error('智能伙伴配置请求失败')
  }

  const data = (await response.json()) as PartnerConfigResponse

  if (!data.success) {
    throw new Error('智能伙伴配置返回失败')
  }

  return extractPartnerConfig(data)
}
