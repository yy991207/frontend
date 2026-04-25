/**
 * 认证信息工具函数
 * 从 localStorage 获取主应用存储的 SUPERSONIC_TOKEN 和 userInfo
 */

/**
 * 获取 SUPERSONIC_TOKEN
 * 优先级：URL 参数 > localStorage
 */
export function getAuthToken(): string {
  // 尝试从 URL 参数获取 token
  const urlParams = new URLSearchParams(window.location.search)
  const urlToken = urlParams.get('token')
  if (urlToken) {
    console.log('[auth] ✅ 从 URL 参数获取 token:', urlToken.substring(0, 20) + '...')
    return urlToken
  }

  // 从 localStorage 获取
  try {
    const token = localStorage.getItem('SUPERSONIC_TOKEN')
    if (!token) {
      console.warn('[auth] ⚠️ localStorage 中未找到 SUPERSONIC_TOKEN')
      return ''
    }
    console.log('[auth] ✅ 从 localStorage 获取 token 成功:', token.substring(0, 20) + '...')
    return token
  } catch (e) {
    console.error('[auth] ❌ Failed to get token from localStorage:', e)
    return ''
  }
}

/**
 * 获取用户 ID
 * 优先级：URL 参数 > localStorage userInfo.id > sessionStorage
 */
export function getUserId(): string {
  // 尝试从 URL 参数获取 user_id
  const urlParams = new URLSearchParams(window.location.search)
  const urlUserId = urlParams.get('user_id')
  if (urlUserId) {
    return urlUserId
  }

  // 从 sessionStorage 获取（微前端刷新场景）
  try {
    const sessionUserId = sessionStorage.getItem('taskfeis_user_id')
    if (sessionUserId) {
      return sessionUserId
    }
  } catch (e) {
    console.error('[auth] Failed to get userId from sessionStorage:', e)
  }

  // 从 localStorage 获取
  try {
    // 优先使用 userInfo.id
    const userInfoStr = localStorage.getItem('userInfo')
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr)
      if (userInfo.id) {
        return String(userInfo.id)
      }
    }

    // 备用 SUPERSONIC_ID
    const superId = localStorage.getItem('SUPERSONIC_ID')
    return superId || ''
  } catch (e) {
    console.error('[auth] Failed to get userId from localStorage:', e)
    return ''
  }
}

/**
 * 获取租户 ID
 * 优先级：URL 参数 > localStorage SUPERSONIC_TENANT_ID > userInfo.loginTenantId
 */
export function getTenantId(): string {
  // 尝试从 URL 参数获取 tenant_id
  const urlParams = new URLSearchParams(window.location.search)
  const urlTenantId = urlParams.get('tenant_id')
  if (urlTenantId) {
    console.log('[auth] 从 URL 参数获取 tenant_id')
    return urlTenantId
  }

  try {
    // 优先级 1: SUPERSONIC_TENANT_ID
    let tenantId = localStorage.getItem('SUPERSONIC_TENANT_ID')
    
    // 优先级 2: userInfo.loginTenantId
    if (!tenantId) {
      const userInfoStr = localStorage.getItem('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        if (userInfo.loginTenantId !== undefined && userInfo.loginTenantId !== null) {
          tenantId = String(userInfo.loginTenantId)
        }
      }
    }
    
    if (tenantId) {
      return tenantId
    }
    
    // 默认值
    return '1000'
  } catch (e) {
    console.error('[auth] Failed to get tenantId:', e)
    return '1000'
  }
}
