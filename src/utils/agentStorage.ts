export type EnabledSkill = {
  skill_name: string
  chinese_name: string
  description: string
  template?: string
}

export type PresetQuestion = {
  category: string
  question: string
}

export type ChatHistoryItem = {
  role: 'user' | 'assistant'
  content: string
}

export type AgentLocalConfig = {
  agent_id: string
  agent_name: string
  agent_prompt: string
  description: string
  enable_web_search: boolean
  enabled_skills: EnabledSkill[]
  resource_ids: string[]
  chat_history: ChatHistoryItem[]
  updated_at: number
}

const STORAGE_KEY_PREFIX = 'agent_config_'
const HISTORY_KEY_PREFIX = 'agent_history_'

function getAgentConfigKey(agentId: string): string {
  return `${STORAGE_KEY_PREFIX}${agentId}`
}

function getAgentHistoryKey(agentId: string): string {
  return `${HISTORY_KEY_PREFIX}${agentId}`
}

export function saveAgentConfig(config: AgentLocalConfig): void {
  try {
    const key = getAgentConfigKey(config.agent_id)
    localStorage.setItem(key, JSON.stringify(config))
  } catch (error) {
    console.error('保存智能体配置到本地存储失败:', error)
  }
}

export function loadAgentConfig(agentId: string): AgentLocalConfig | null {
  try {
    const key = getAgentConfigKey(agentId)
    const data = localStorage.getItem(key)
    if (!data) return null
    return JSON.parse(data) as AgentLocalConfig
  } catch (error) {
    console.error('从本地存储加载智能体配置失败:', error)
    return null
  }
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
    const configKey = getAgentConfigKey(agentId)
    const historyKey = getAgentHistoryKey(agentId)
    localStorage.removeItem(configKey)
    localStorage.removeItem(historyKey)
  } catch (error) {
    console.error('清除智能体本地存储失败:', error)
  }
}
