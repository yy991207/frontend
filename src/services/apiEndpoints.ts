export const DEFAULT_API_BASE_URL = 'http://192.168.30.238:8000/'
export const DEFAULT_USER_ID = '123456'
export const USER_ID_QUERY_PARAM = 'user_id'

export const API_PATHS = {
  skillList: '/api/v1/skills',
  addUserSkill: '/api/v1/users/{user_id}/skills',
  viewUserSkills: '/api/v1/users/{user_id}/skills',
  deleteUserSkill: '/api/v1/users/{user_id}/skills/{skill_name}',
  listCustomSkills: '/api/v1/skills/custom',
  deleteCustomSkill: '/api/v1/skills/custom/{skill_name}',
  uploadCustomSkill: '/api/v1/skills/custom/upload',
  viewPartnerConfig: '/api/v1/agent',
  updatePartnerConfig: '/api/v1/agent',
  commandsList: '/api/v1/commands',
  myCommands: '/api/v1/my-commands',
  generateMyCommand: '/api/v1/my-commands/generate',
  viewChatSessions: '/api/v1/chat/sessions',
  deleteChatSession: '/api/v1/chat/sessions/{session_id}',
  createChatSession: '/api/v1/chat/sessions',
  getChatSession: '/api/v1/chat/sessions/{session_id}',
  viewGeneratedCode: '/api/v1/chat/sessions/{session_id}/files/preview',
  agentFileUpload: '/api/v1/agent/files/upload',
  parseTask: '/api/v1/parse/{task_id}',
  library: '/api/v1/files/library',
  librarySaveToCloudDisk: '/api/v1/files/library/save-to-cloud-disk',
  libraryFilePreview: '/api/v1/chat/files/preview',
  libraryFileDownloadUrl: '/api/v1/chat/files/download-url',
  clawhubBrowse: '/api/v1/skills/clawhub/browse',
  clawhubInstall: '/api/v1/skills/clawhub/{slug}/install',
  clawhubSearch: '/api/v1/skills/clawhub/search',
  createCustomAgent: '/api/v1/custom-agents',
  listCustomAgent: '/api/v1/custom-agents',
  viewCustomAgent: '/api/v1/custom-agents/{agent_id}',
  updateCustomAgent: '/api/v1/custom-agents/{agent_id}',
  deleteCustomAgent: '/api/v1/custom-agents/{agent_id}',
  chatCustomAgent: '/api/v1/custom-agents/debug/stream',
  generateAgentTemplate: '/api/v1/custom-agents/templates/generate',
  getAgentTemplateTask: '/api/v1/custom-agents/templates/tasks/{task_id}',
  agentTemplates: '/api/v1/agent-templates',
  agentTemplateDetail: '/api/v1/agent-templates/{template_id}',
  agentUsageLogs: '/api/v1/custom-agents/usage-logs',
  agentUsageLogDetail: '/api/v1/custom-agents/usage-logs/{agent_id}',
  recommendSkills: '/api/v1/custom-agents/skills/recommend',
  regularSkillDetail: '/api/v1/skills/{skill_name}',
  clawhubSkillDetail: '/api/v1/skills/clawhub/{slug}',
} as const

export function buildAbsoluteApiUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
