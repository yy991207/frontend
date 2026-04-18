import { API_PATHS, USER_ID_QUERY_PARAM, buildAbsoluteApiUrl } from './apiEndpoints'

export type SkillUploadApiConfig = {
  userId: string
  userIdParam: string
  uploadEndpoint: string
}

export type UploadedSkillSummary = {
  skillId: string
  skillName: string
  description: string
}

export type SkillUploadResult = {
  success: boolean
  code: string
  msg: string
  data: UploadedSkillSummary | null
}

type SkillUploadResponse = {
  success?: boolean
  code?: string | number
  msg?: string
  data?: Record<string, unknown> | null
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

function readStringField(record: Record<string, unknown>, keys: string[]) {
  const key = keys.find((field) => typeof record[field] === 'string' && String(record[field]).trim())
  return key ? String(record[key]).trim() : ''
}

function extractUploadedSkillSummary(data: Record<string, unknown> | null | undefined): UploadedSkillSummary | null {
  if (!data) {
    return null
  }

  const skillId = readStringField(data, ['skill_id', 'skillId', 'id'])
  const skillName = readStringField(data, ['skill_name', 'skillName', 'name'])
  const description = readStringField(data, ['description', 'desc'])

  if (!skillId && !skillName && !description) {
    return null
  }

  return {
    skillId,
    skillName,
    description,
  }
}

async function normalizeSkillUploadResponse(response: Response): Promise<SkillUploadResult> {
  let payload: SkillUploadResponse | null = null

  try {
    payload = (await response.json()) as SkillUploadResponse
  } catch {
    payload = null
  }

  const success = Boolean(payload?.success)
  const code = String(payload?.code ?? (response.ok ? '200' : response.status || '500'))
  const msg = typeof payload?.msg === 'string' && payload.msg.trim()
    ? payload.msg.trim()
    : success
      ? 'Skill 上传成功'
      : '技能上传失败，请稍后重试'

  return {
    success,
    code,
    msg,
    data: extractUploadedSkillSummary(payload?.data),
  }
}

export function parseSkillUploadApiConfig(rawText: string): SkillUploadApiConfig {
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
    uploadEndpoint: buildAbsoluteApiUrl(baseUrl, API_PATHS.uploadCustomSkill),
  }
}

export async function uploadCustomSkill(config: SkillUploadApiConfig, file: File, signal?: AbortSignal): Promise<SkillUploadResult> {
  const requestUrl = new URL(config.uploadEndpoint)
  requestUrl.searchParams.set(config.userIdParam, config.userId)

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(requestUrl.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
    signal,
  })

  return normalizeSkillUploadResponse(response)
}
