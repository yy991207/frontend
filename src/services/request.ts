import { getConfig } from '@/config/appConfig'
import { getAuthHeaders } from '../utils/http'

export interface ApiResponse<T> {
  success: boolean
  code: string
  msg: string
  data: T
}

function buildUrl(path: string): string {
  const config = getConfig()
  const base = config.url.replace(/\/+$/, '')
  const p = path.replace(/^\/+/, '')
  return `${base}/${p}`
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isJsonBody = options?.body && !(options.body instanceof FormData)
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(`请求失败 (${res.status})`)
  }

  const rawText = await res.text()
  if (!rawText.trim()) {
    return undefined as T
  }

  const json: ApiResponse<T> = JSON.parse(rawText) as ApiResponse<T>
  if (!json.success) {
    throw new Error(json.msg || `请求失败 (${json.code})`)
  }
  return json.data
}
