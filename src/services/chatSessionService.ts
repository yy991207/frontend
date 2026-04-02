export type ChatSession = {
  session_id: string
  session_name: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export type ChatSessionMessage = {
  message_id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls: unknown[]
  references: unknown[]
  skill_output: unknown
  created_at: string
}

export type ChatSessionDetail = ChatSession & {
  theme_id: string | null
  tool_type: string | null
  tool_config: unknown
  message_count: number
  messages: ChatSessionMessage[]
}

export type ChatSessionsResponse = {
  sessions: ChatSession[]
  total: number
}

export type ChatSessionConfig = {
  baseUrl: string
  userId: string
  viewChatSessionsPath: string
  delChatSessionPath: string
  getChatSessionPath: string
}

// 从 config.yaml 读取的配置
const DEFAULT_CONFIG: ChatSessionConfig = {
  baseUrl: 'http://192.168.30.238:8000/',
  userId: '123456',
  viewChatSessionsPath: '/api/v1/chat/sessions',
  delChatSessionPath: '/api/v1/chat/sessions',
  getChatSessionPath: '/api/v1/chat/sessions/{session_id}',
}

/**
 * 解析配置文件获取会话列表相关配置
 */
export function parseChatSessionConfig(rawText: string): ChatSessionConfig {
  const lines = rawText.split(/\r?\n/)
  const config: Record<string, string> = {}

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf(':')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

    if (key) {
      config[key] = value
    }
  }

  const baseUrl = config.url || DEFAULT_CONFIG.baseUrl
  const userId = config.user_id || DEFAULT_CONFIG.userId
  const viewChatSessionsPath = config.view_chat_sessions_path || DEFAULT_CONFIG.viewChatSessionsPath
  const delChatSessionPath = config.del_chat_session_path || DEFAULT_CONFIG.delChatSessionPath
  const getChatSessionPath = config.get_chat_session_path || DEFAULT_CONFIG.getChatSessionPath

  if (!baseUrl || !userId || !viewChatSessionsPath) {
    throw new Error('config.yaml 缺少 url、user_id 或 view_chat_sessions_path 配置')
  }

  return {
    baseUrl,
    userId,
    viewChatSessionsPath,
    delChatSessionPath,
    getChatSessionPath,
  }
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): ChatSessionConfig {
  return { ...DEFAULT_CONFIG }
}

/**
 * 获取用户的会话列表
 */
export async function fetchChatSessions(
  config: ChatSessionConfig,
  signal?: AbortSignal,
): Promise<ChatSession[]> {
  const url = new URL(config.viewChatSessionsPath, config.baseUrl)
  url.searchParams.set('user_id', config.userId)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error('获取会话列表失败')
  }

  const data = (await response.json()) as ChatSessionsResponse
  return data.sessions || []
}

/**
 * 根据 updated_at 将会话分组为：今天、7天内、7天外
 * 并按时间倒序排列（最新的在上）
 */
export function groupSessionsByTime(sessions: ChatSession[]): {
  today: ChatSession[]
  within7Days: ChatSession[]
  beyond7Days: ChatSession[]
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 按 updated_at 倒序排序（最新的在前）
  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  const result = {
    today: [] as ChatSession[],
    within7Days: [] as ChatSession[],
    beyond7Days: [] as ChatSession[],
  }

  for (const session of sortedSessions) {
    const updatedAt = new Date(session.updated_at)
    const updatedAtDate = new Date(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDate())

    if (updatedAtDate.getTime() === today.getTime()) {
      result.today.push(session)
    } else if (updatedAtDate.getTime() >= sevenDaysAgo.getTime()) {
      result.within7Days.push(session)
    } else {
      result.beyond7Days.push(session)
    }
  }

  return result
}

/**
 * 获取会话显示名称
 * 如果 session_name 为 null，则返回默认名称"话题"
 */
export function getSessionDisplayName(session: ChatSession): string {
  return session.session_name ?? '话题'
}

/**
 * 删除会话
 */
export async function deleteChatSession(
  config: ChatSessionConfig,
  sessionId: string,
  signal?: AbortSignal,
): Promise<void> {
  // 替换路径中的 {session_id} 占位符
  const path = config.delChatSessionPath.replace('{session_id}', sessionId)
  const url = new URL(path, config.baseUrl)

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error('删除会话失败')
  }
}

export async function getChatSession(
  config: ChatSessionConfig,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ChatSessionDetail> {
  const path = config.getChatSessionPath.replace('{session_id}', sessionId)
  const url = new URL(path, config.baseUrl)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error('获取会话详情失败')
  }

  return (await response.json()) as ChatSessionDetail
}
