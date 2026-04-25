/**
 * TaskFeis 配置加载器
 * 提供统一的配置获取方式，不再依赖 config.yaml
 * 配置来源优先级：URL 参数 > sessionStorage > localStorage > 默认值
 */

interface AppConfig {
  url: string
  user_id: string
  team_id: string
  token: string
}

// 默认配置
const defaultConfig: AppConfig = {
  url: 'https://test-guoren-ai.grtcloud.net/',
  user_id: '',
  team_id: '',
  token: ''
}

/**
 * 获取应用配置
 * 所有配置从 URL 参数、sessionStorage、localStorage 获取
 */
export function getAppConfig(): AppConfig {
  const config: AppConfig = { ...defaultConfig }

  if (typeof window === 'undefined') {
    return config
  }

  // 1. 优先从 URL 参数获取
  const urlParams = new URLSearchParams(window.location.search)
  const urlUserId = urlParams.get('user_id')
  const urlUserName = urlParams.get('user_name')
  
  if (urlUserId) {
    config.user_id = urlUserId
    console.log('[appConfig] 从 URL 参数获取 user_id:', urlUserId)
  }
  
  if (urlUserName) {
    // 可以将 user_name 存储到 config 或 localStorage
    console.log('[appConfig] 从 URL 参数获取 user_name:', urlUserName)
  }

  // 2. 如果 URL 没有参数，尝试从 sessionStorage 获取（微前端刷新场景）
  if (!config.user_id) {
    const sessionUserId = sessionStorage.getItem('taskfeis_user_id')
    const sessionUserName = sessionStorage.getItem('taskfeis_user_name')
    
    if (sessionUserId) {
      config.user_id = sessionUserId
      console.log('[appConfig] 从 sessionStorage 获取 user_id:', sessionUserId)
    }
    
    if (sessionUserName) {
      console.log('[appConfig] 从 sessionStorage 获取 user_name:', sessionUserName)
    }
  }

  // 3. 从 localStorage 获取团队 ID（用户选择的团队会持久化）
  // 优先级：localStorage.current_team_id > URL 参数 team_id > userInfo.teamId
  const storedTeamId = localStorage.getItem('current_team_id')
  if (storedTeamId) {
    config.team_id = storedTeamId
    console.log('[appConfig] ✅ 从 localStorage.current_team_id 获取 team_id:', storedTeamId)
  } else {
    // 尝试从 URL 参数获取
    const urlTeamId = urlParams.get('team_id')
    if (urlTeamId) {
      config.team_id = urlTeamId
      console.log('[appConfig] ✅ 从 URL 参数获取 team_id:', urlTeamId)
    } else {
      // 尝试从 userInfo 获取
      try {
        const userInfoStr = localStorage.getItem('userInfo')
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr)
          if (userInfo.teamId) {
            config.team_id = String(userInfo.teamId)
            console.log('[appConfig] ✅ 从 userInfo.teamId 获取 team_id:', config.team_id)
          }
        }
      } catch (e) {
        console.error('[appConfig] ❌ 解析 userInfo 失败:', e)
      }
    }
  }
  
  if (!config.team_id) {
    console.warn('[appConfig] ⚠️ 未找到 team_id，API 请求可能会失败')
  }

  // 4. 从 localStorage 获取 token（如果有）
  const storedToken = localStorage.getItem('auth_token')
  if (storedToken) {
    config.token = storedToken
    console.log('[appConfig] 从 localStorage 获取 token')
  }

  // 验证必要参数
  if (!config.user_id) {
    console.warn('[appConfig] ⚠️ 缺少 user_id，请确保通过主应用访问或已登录')
  }

  return config
}

/**
 * 切换当前用户
 * @param userId 用户 ID
 */
export function switchCurrentUser(userId: string): void {
  localStorage.setItem('current_user_id', userId)
  sessionStorage.setItem('taskfeis_user_id', userId)
  window.location.reload()
}

/**
 * 切换当前团队
 * @param teamId 团队 ID
 */
export function switchCurrentTeam(teamId: string): void {
  localStorage.setItem('current_team_id', teamId)
  window.location.reload()
}

// 导出一个便捷函数，用于获取配置实例
let cachedConfig: AppConfig | null = null

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = getAppConfig()
  }
  return cachedConfig
}
