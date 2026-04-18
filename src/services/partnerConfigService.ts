import { API_PATHS, buildAbsoluteApiUrl } from './apiEndpoints'

export type PartnerApiConfig = {
  userId: string
  viewConfigEndpoint: string
  updateConfigEndpoint: string
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

export type PartnerConfigUpdateField = 'agent_name' | 'SOUL.md' | 'USER.md' | 'IDENTITY.md'

type PartnerConfigUpdateResponse = {
  success?: boolean
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

export function parsePartnerApiConfig(rawText: string): PartnerApiConfig {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const userId = parsedConfig.user_id

  if (!baseUrl || !userId) {
    throw new Error('config.yaml 缺少 url 或 user_id 配置')
  }

  return {
    userId,
    viewConfigEndpoint: buildAbsoluteApiUrl(baseUrl, API_PATHS.viewPartnerConfig),
    updateConfigEndpoint: buildAbsoluteApiUrl(baseUrl, API_PATHS.updatePartnerConfig),
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

export function buildPartnerConfigUpdatePayload(field: PartnerConfigUpdateField, value: string) {
  if (field === 'agent_name') {
    return {
      agent_name: value,
    }
  }

  if (field === 'USER.md') {
    return {
      USER_md: value,
    }
  }

  return {
    [field]: value,
  }
}

export async function updatePartnerConfig(
  config: PartnerApiConfig,
  field: PartnerConfigUpdateField,
  value: string,
  signal?: AbortSignal,
) {
  const requestUrl = new URL(config.updateConfigEndpoint)
  requestUrl.searchParams.set('user_id', config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(buildPartnerConfigUpdatePayload(field, value)),
    signal,
  })

  if (!response.ok) {
    throw new Error('智能伙伴配置更新失败')
  }

  const data = (await response.json()) as PartnerConfigUpdateResponse

  if (!data.success) {
    throw new Error('智能伙伴配置更新返回失败')
  }
}
