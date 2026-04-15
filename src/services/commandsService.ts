import chatConfigText from '../../config.yaml?raw'

export type CommandApiItem = {
  id: string
  type: 'recommend' | 'practice'
  name: string
  description: string
  template: string
  attachments: unknown[]
  icon: string | null
  messages: unknown[] | null
  created_at: string | null
}

export type CommandsData = {
  official_commands: CommandApiItem[]
  best_practices: CommandApiItem[]
  my_commands: CommandApiItem[]
}

export type CommandsResponse = {
  success: boolean
  code: string
  msg: string
  data: CommandsData
}

export type CommandPromptItem = {
  id: number
  icon: string
  title: string
  summary: string
  template: string
}

const MAX_DESCRIPTION_LENGTH = 200

function parseSimpleYaml(rawText: string) {
  return rawText.split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      return result
    }
    const separatorIndex = trimmedLine.indexOf(':')
    if (separatorIndex === -1) {
      return result
    }
    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key) {
      result[key] = value
    }
    return result
  }, {})
}

function buildAbsoluteUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function getCommandsEndpoint(): string {
  const parsedConfig = parseSimpleYaml(chatConfigText)
  const baseUrl = parsedConfig.url
  const commandsPath = parsedConfig.commands_list_path ?? '/api/v1/commands'
  return buildAbsoluteUrl(baseUrl, commandsPath)
}

export function getUserId(): string {
  const parsedConfig = parseSimpleYaml(chatConfigText)
  return parsedConfig.user_id
}

export function mapCommandsToPromptItems(commands: CommandApiItem[]): CommandPromptItem[] {
  return commands.map((cmd, index) => ({
    id: index + 1,
    icon: cmd.icon ?? '📝',
    title: cmd.name,
    summary: cmd.description.length > MAX_DESCRIPTION_LENGTH
      ? `${cmd.description.slice(0, MAX_DESCRIPTION_LENGTH)}…`
      : cmd.description,
    template: cmd.template,
  }))
}

export async function fetchCommands(signal?: AbortSignal): Promise<CommandsResponse> {
  const requestUrl = new URL(getCommandsEndpoint())
  requestUrl.searchParams.set('user_id', getUserId())

  const response = await fetch(requestUrl.toString(), { signal })

  if (!response.ok) {
    throw new Error('指令接口请求失败')
  }

  const data = (await response.json()) as CommandsResponse

  if (!data.success) {
    throw new Error(data.msg || '指令接口返回失败')
  }

  return data
}

export type SaveCommandStep1Response = {
  name: string
  template: string
  attachments: unknown[]
  source_session_id: string
}

export type CreateCommandRequest = {
  name: string
  template: string
  attachments: unknown[]
  source_session_id: string
}

export type CreateCommandResponse = {
  id: string
  name: string
  template: string
  attachments: unknown[]
}

function getMyCommandsEndpoint(): string {
  const parsedConfig = parseSimpleYaml(chatConfigText)
  const baseUrl = parsedConfig.url
  return buildAbsoluteUrl(baseUrl, '/api/v1/my-commands')
}

export async function generateCommandFromSession(
  sessionId: string,
): Promise<SaveCommandStep1Response> {
  const response = await fetch(getMyCommandsEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  })

  if (!response.ok) {
    throw new Error('生成指令模板失败')
  }

  return (await response.json()) as SaveCommandStep1Response
}

export async function createCommand(
  data: CreateCommandRequest,
): Promise<CreateCommandResponse> {
  const response = await fetch(getMyCommandsEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('创建指令失败')
  }

  return (await response.json()) as CreateCommandResponse
}
