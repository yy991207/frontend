import type { SkillItem, SkillApiResponse } from './skillPromptService'
import { normalizeSkillItems } from './skillPromptService'

export type ClawhubBrowseParams = {
  baseUrl: string
  userId: string
  limit: number
  offset?: number
  signal?: AbortSignal
}

export type ClawhubBrowseResult = {
  success: boolean
  skills: SkillItem[]
  total: number
  msg?: string
}

export async function fetchClawhubSkills(params: ClawhubBrowseParams): Promise<ClawhubBrowseResult> {
  const { baseUrl, userId, limit, offset = 0, signal } = params

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/v1/skills/clawhub/browse`
  const requestUrl = new URL(endpoint)

  requestUrl.searchParams.set('user_id', userId)
  requestUrl.searchParams.set('limit', String(limit))
  requestUrl.searchParams.set('offset', String(offset))

  try {
    const response = await fetch(requestUrl.toString(), { signal })

    if (!response.ok) {
      throw new Error('Clawhub 接口请求失败')
    }

    const data = (await response.json()) as SkillApiResponse

    if (!data.success) {
      throw new Error(data.msg || 'Clawhub 接口返回失败')
    }

    const payload = data.data as Record<string, unknown> | undefined
    const skills = Array.isArray(payload?.skills) ? payload.skills : []
    const total = typeof payload?.total === 'number' ? payload.total : skills.length

    return {
      success: true,
      skills: normalizeSkillItems(skills),
      total,
    }
  } catch (error) {
    if (signal?.aborted) {
      return { success: false, skills: [], total: 0 }
    }

    return {
      success: false,
      skills: [],
      total: 0,
      msg: error instanceof Error ? error.message : 'Clawhub 技能加载失败',
    }
  }
}