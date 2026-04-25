/**
 * 统一的 HTTP 请求工具
 * 自动添加认证 header:
 * - x-access-token: SUPERSONIC_TOKEN
 * - x-tenant-id: SUPERSONIC_TENANT_ID 或 userInfo.loginTenantId
 */

import { getAuthToken, getTenantId } from './auth'

/**
 * 获取认证 headers
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}

  // 获取 token
  const token = getAuthToken()
  if (token) {
    headers['x-access-token'] = token
  }

  // 获取 tenant_id
  const tenantId = getTenantId()
  if (tenantId) {
    headers['x-tenant-id'] = tenantId
  }

  return headers
}

/**
 * 合并 headers，确保认证 header 优先
 */
export function mergeHeaders(
  existingHeaders?: HeadersInit | null
): HeadersInit {
  const authHeaders = getAuthHeaders()
  
  if (!existingHeaders) {
    return authHeaders
  }

  // 如果已有 headers 是 Headers 对象
  if (existingHeaders instanceof Headers) {
    const merged = new Headers(existingHeaders)
    Object.entries(authHeaders).forEach(([key, value]) => {
      merged.set(key, value)
    })
    return merged
  }

  // 如果已有 headers 是数组
  if (Array.isArray(existingHeaders)) {
    const existingMap = new Map(existingHeaders)
    const merged = [...existingMap.entries()]
    Object.entries(authHeaders).forEach(([key, value]) => {
      merged.push([key, value])
    })
    return merged
  }

  // 如果已有 headers 是对象
  return {
    ...existingHeaders,
    ...authHeaders,
  }
}

/**
 * 增强的 fetch 函数，自动添加认证 headers
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const enhancedInit: RequestInit = {
    ...init,
    headers: mergeHeaders(init?.headers),
  }

  return fetch(input, enhancedInit)
}

/**
 * 创建带有认证信息的 RequestInit
 * 用于需要手动构建请求的场景
 */
export function createAuthRequestInit(
  init?: RequestInit
): RequestInit {
  return {
    ...init,
    headers: mergeHeaders(init?.headers),
  }
}

/**
 * 初始化全局 fetch 拦截器
 * 在应用启动时调用一次，所有 fetch 请求都会自动添加认证 headers
 */
export function initFetchInterceptor(): void {
  if (typeof window === 'undefined') {
    return
  }

  // 保存原始 fetch 到全局变量，供需要绕过拦截器的场景使用
  if (!(window as any).__ORIGINAL_FETCH__) {
    ;(window as any).__ORIGINAL_FETCH__ = window.fetch
  }

  // 保存原始 fetch
  const originalFetch = window.fetch

  // 重写 fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // 跳过某些不需要认证的请求（如静态资源）
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    
    // 如果是静态资源或特定路径，不添加认证 headers
    if (url.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/i)) {
      return originalFetch.call(this, input, init)
    }

    // 添加认证 headers
    const enhancedInit: RequestInit = {
      ...init,
      headers: mergeHeaders(init?.headers),
    }

    return originalFetch.call(this, input, enhancedInit)
  }

  console.log('[http] Fetch interceptor initialized with auth headers')
}
