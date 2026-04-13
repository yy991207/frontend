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

export type ClawhubSkillDetail = {
  id: string
  skillName: string
  title: string
  description: string
  template: string
  isSelected: boolean
  tags: string[]
  downloads: number
  stars: number
  owner: string
  version: string
  summary: string
}

export type ClawhubDetailParams = {
  baseUrl: string
  userId: string
  slug: string
  signal?: AbortSignal
}

export type ClawhubDetailResult = {
  success: boolean
  skill?: ClawhubSkillDetail
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

export type ClawhubInstallParams = {
  baseUrl: string
  userId: string
  slug: string
  signal?: AbortSignal
}

export type ClawhubInstallResult = {
  success: boolean
  msg?: string
}

export async function installClawhubSkill(params: ClawhubInstallParams): Promise<ClawhubInstallResult> {
  const { baseUrl, userId, slug, signal } = params

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/v1/skills/clawhub/${encodeURIComponent(slug)}/install`
  const requestUrl = new URL(endpoint)

  requestUrl.searchParams.set('user_id', userId)

  try {
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    })

    if (!response.ok) {
      throw new Error('Clawhub 安装接口请求失败')
    }

    const data = (await response.json()) as {
      success: boolean
      msg?: string
    }

    return {
      success: data.success,
      msg: data.msg,
    }
  } catch (error) {
    if (signal?.aborted) {
      return { success: false }
    }

    return {
      success: false,
      msg: error instanceof Error ? error.message : 'Clawhub 技能安装失败',
    }
  }
}

export type ClawhubSearchParams = {
  baseUrl: string
  userId: string
  q: string
  limit?: number
  signal?: AbortSignal
}

export type ClawhubSearchResult = {
  success: boolean
  skills: SkillItem[]
  total: number
  msg?: string
}

export async function searchClawhubSkills(params: ClawhubSearchParams): Promise<ClawhubSearchResult> {
  const { baseUrl, userId, q, limit = 20, signal } = params

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/v1/skills/clawhub/search`
  const requestUrl = new URL(endpoint)

  requestUrl.searchParams.set('q', q)
  requestUrl.searchParams.set('limit', String(limit))
  requestUrl.searchParams.set('user_id', userId)

  try {
    const response = await fetch(requestUrl.toString(), { signal })

    if (!response.ok) {
      throw new Error('Clawhub 搜索接口请求失败')
    }

    const data = (await response.json()) as SkillApiResponse

    if (!data.success) {
      throw new Error(data.msg || 'Clawhub 搜索接口返回失败')
    }

    const payload = data.data as Record<string, unknown> | undefined
    const rawSkills = Array.isArray(payload?.skills) ? payload.skills : []
    const total = typeof payload?.total === 'number' ? payload?.total : rawSkills.length

    const skills = rawSkills.map((skill: Record<string, unknown>) => ({
      id: String(skill.name || ''),
      skillName: String(skill.name || ''),
      title: String(skill.chinese_name || skill.name || ''),
      description: String(skill.description || ''),
      template: typeof skill.template === 'string' ? skill.template : '',
      isSelected: Boolean(skill.is_selected),
    }))

    return {
      success: true,
      skills,
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
      msg: error instanceof Error ? error.message : 'Clawhub 搜索失败',
    }
  }
}

export async function fetchClawhubSkillDetail(params: ClawhubDetailParams): Promise<ClawhubDetailResult> {
  const { baseUrl, userId, slug, signal } = params

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/v1/skills/clawhub/${encodeURIComponent(slug)}`
  const requestUrl = new URL(endpoint)
  requestUrl.searchParams.set('user_id', userId)

  try {
    const response = await fetch(requestUrl.toString(), { signal })

    if (!response.ok) {
      throw new Error('Clawhub 详情接口请求失败')
    }

    const data = (await response.json()) as {
      success: boolean
      code: string
      msg: string
      data?: {
        skill?: {
          slug: string
          displayName: string
          summary: string
          is_selected?: boolean
          tags?: string[]
          stats?: {
            downloads: number
            stars: number
          }
        }
        latestVersion?: {
          version: string
        }
        owner?: {
          handle: string
          displayName: string
        }
        metaContent?: {
          DisplayDescription?: string
          Keywords?: string[]
          skillMd?: string
        }
      }
    }

    if (!data.success) {
      throw new Error(data.msg || 'Clawhub 详情接口返回失败')
    }

    const payload = data.data
    if (!payload?.skill) {
      throw new Error('Clawhub 详情数据格式错误')
    }

    const skill = payload.skill
    const metaContent = payload.metaContent || {}
    const description = metaContent.DisplayDescription || skill.summary || ''
    const template = metaContent.skillMd || ''

    return {
      success: true,
      skill: {
        id: skill.slug,
        skillName: skill.slug,
        title: skill.displayName,
        description,
        isSelected: Boolean(skill.is_selected),
        template,
        tags: skill.tags || metaContent.Keywords || [],
        downloads: skill.stats?.downloads || 0,
        stars: skill.stats?.stars || 0,
        owner: payload.owner?.displayName || payload.owner?.handle || '',
        version: payload.latestVersion?.version || '1.0.0',
        summary: skill.summary,
      },
    }
  } catch (error) {
    if (signal?.aborted) {
      return { success: false }
    }

    return {
      success: false,
      msg: error instanceof Error ? error.message : 'Clawhub 技能详情加载失败',
    }
  }
}