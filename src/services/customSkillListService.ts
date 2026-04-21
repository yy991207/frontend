import { API_PATHS, USER_ID_QUERY_PARAM, buildAbsoluteApiUrl } from './apiEndpoints'
import { extractSkillItemsFromResponse, type SkillApiResponse, type SkillItem } from './skillPromptService.ts'

export type CustomSkillListApiConfig = {
  userId: string
  userIdParam: string
  listEndpoint: string
  deleteEndpointTemplate?: string
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

export function parseCustomSkillListApiConfig(rawText: string): CustomSkillListApiConfig {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const userId = parsedConfig.user_id
  const userIdParam = USER_ID_QUERY_PARAM

  if (!baseUrl || !userId) {
    throw new Error('config.yaml 缺少 url 或 user_id 配置')
  }

  return {
    userId,
    userIdParam,
    listEndpoint: buildAbsoluteApiUrl(baseUrl, API_PATHS.listCustomSkills),
    deleteEndpointTemplate: buildAbsoluteApiUrl(baseUrl, API_PATHS.deleteCustomSkill),
  }
}

export async function fetchCreatedSkills(config: CustomSkillListApiConfig, signal?: AbortSignal): Promise<SkillItem[]> {
  const requestUrl = new URL(config.listEndpoint)
  requestUrl.searchParams.set(config.userIdParam, config.userId)

  const response = await fetch(requestUrl.toString(), {
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error('我创建的技能列表请求失败')
  }

  const data = (await response.json()) as SkillApiResponse

  if (!data.success) {
    throw new Error(data.msg || '我创建的技能列表返回失败')
  }

  return extractSkillItemsFromResponse(data)
}

export async function deleteCreatedSkill(
  config: CustomSkillListApiConfig,
  skillName: string,
  signal?: AbortSignal,
): Promise<void> {
  const normalizedSkillName = skillName.trim()

  if (!config.deleteEndpointTemplate) {
    throw new Error('缺少删除技能接口配置')
  }

  if (!normalizedSkillName) {
    throw new Error('skill_name 不能为空')
  }

  const deleteEndpoint = config.deleteEndpointTemplate.includes('{skill_name}')
    ? config.deleteEndpointTemplate.replace('{skill_name}', encodeURIComponent(normalizedSkillName))
    : config.deleteEndpointTemplate
  const requestUrl = new URL(deleteEndpoint)
  requestUrl.searchParams.set(config.userIdParam, config.userId)

  const response = await fetch(requestUrl.toString(), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error('删除我创建的技能失败')
  }

  const data = (await response.json()) as SkillApiResponse

  if (!data.success) {
    throw new Error(data.msg || '删除我创建的技能失败')
  }
}
