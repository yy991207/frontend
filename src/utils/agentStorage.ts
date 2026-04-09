export type ChatHistoryItem = {
  role: 'user' | 'assistant'
  content: string
}

const HISTORY_KEY_PREFIX = 'agent_history_'

function getAgentHistoryKey(agentId: string): string {
  return `${HISTORY_KEY_PREFIX}${agentId}`
}

export function saveChatHistory(agentId: string, history: ChatHistoryItem[]): void {
  try {
    const key = getAgentHistoryKey(agentId)
    localStorage.setItem(key, JSON.stringify(history))
  } catch (error) {
    console.error('保存聊天历史到本地存储失败:', error)
  }
}

export function loadChatHistory(agentId: string): ChatHistoryItem[] {
  try {
    const key = getAgentHistoryKey(agentId)
    const data = localStorage.getItem(key)
    if (!data) return []
    return JSON.parse(data) as ChatHistoryItem[]
  } catch (error) {
    console.error('从本地存储加载聊天历史失败:', error)
    return []
  }
}

export function clearAgentStorage(agentId: string): void {
  try {
    const historyKey = getAgentHistoryKey(agentId)
    localStorage.removeItem(historyKey)
  } catch (error) {
    console.error('清除智能体本地存储失败:', error)
  }
}
