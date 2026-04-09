const HISTORY_KEY_PREFIX = 'agent_history_'

function getAgentHistoryKey(agentId: string): string {
  return `${HISTORY_KEY_PREFIX}${agentId}`
}

export function clearAgentStorage(agentId: string): void {
  try {
    const historyKey = getAgentHistoryKey(agentId)
    localStorage.removeItem(historyKey)
  } catch (error) {
    console.error('清除智能体本地存储失败:', error)
  }
}
