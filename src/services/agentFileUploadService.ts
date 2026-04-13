import {
  uploadPendingFileToOss,
  type UploadedFile,
} from './ossUploadService'

export type AgentFileApiConfig = {
  userId: string
  uploadEndpoint: string
  parseTaskEndpoint: string
}

type UploadParseTaskResponse = {
  success?: boolean
  code?: string
  msg?: string
  data?: ParseTaskSubmission
}

type ParseTaskSubmission = {
  task_id: string
  resource_id?: string
  file_name?: string
  message?: string
}

type ParseTaskStatusResponse = {
  task_id?: string
  resource_id?: string
  status?: string
  progress?: number | null
  result?: Record<string, unknown> | null
  error?: string | null
}

type UploadWithParseOptions = {
  onProgress?: (progress: number) => void
  onStatusChange?: (file: UploadedFile) => void
  signal?: AbortSignal
  pollIntervalMs?: number
  maxPollAttempts?: number
}

const DEFAULT_POLL_INTERVAL_MS = 1500
const DEFAULT_MAX_POLL_ATTEMPTS = 40
const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
])

let cachedAgentFileApiConfig: AgentFileApiConfig | null = null

function parseSimpleYaml(rawText: string): Record<string, string> {
  const lines = rawText.split(/\r?\n/)
  const config: Record<string, string> = {}

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
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

  return config
}

function buildAbsoluteUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function getParseTaskEndpoint(config: AgentFileApiConfig, taskId: string) {
  return config.parseTaskEndpoint.replace('{task_id}', encodeURIComponent(taskId))
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const handleAbort = () => {
      cleanup()
      reject(new DOMException('请求已取消', 'AbortError'))
    }

    const cleanup = () => {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', handleAbort)
    }

    if (signal?.aborted) {
      cleanup()
      reject(new DOMException('请求已取消', 'AbortError'))
      return
    }

    signal?.addEventListener('abort', handleAbort)
  })
}

export function parseAgentFileApiConfig(rawText: string): AgentFileApiConfig {
  const parsedConfig = parseSimpleYaml(rawText)
  const baseUrl = parsedConfig.url
  const userId = parsedConfig.user_id

  if (!baseUrl || !userId) {
    throw new Error('config.yaml 缺少 url 或 user_id 配置')
  }

  return {
    userId,
    uploadEndpoint: buildAbsoluteUrl(baseUrl, '/api/v1/agent/files/upload'),
    parseTaskEndpoint: buildAbsoluteUrl(baseUrl, '/api/v1/parse/{task_id}'),
  }
}

export async function loadAgentFileApiConfig(): Promise<AgentFileApiConfig> {
  if (cachedAgentFileApiConfig) {
    return cachedAgentFileApiConfig
  }

  const response = await fetch('/config.yaml')
  if (!response.ok) {
    throw new Error('读取 config.yaml 失败')
  }

  const rawText = await response.text()
  cachedAgentFileApiConfig = parseAgentFileApiConfig(rawText)
  return cachedAgentFileApiConfig
}

export function isDocumentFile(file: Pick<UploadedFile, 'ext' | 'type' | 'name'>) {
  const ext = (file.ext || file.name.split('.').pop() || '').toLowerCase()
  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return true
  }

  return file.type.startsWith('text/')
}

async function submitParseTask(
  config: AgentFileApiConfig,
  uploadedFile: UploadedFile,
  signal?: AbortSignal,
) {
  const response = await fetch(config.uploadEndpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_name: uploadedFile.name,
      url: uploadedFile.url,
      user_id: config.userId,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error('提交文档解析任务失败')
  }

  const result = await response.json() as UploadParseTaskResponse
  if (!result.success || !result.data?.task_id) {
    throw new Error(result.msg || '提交文档解析任务失败')
  }

  return result.data
}

async function getParseTaskStatus(
  config: AgentFileApiConfig,
  taskId: string,
  signal?: AbortSignal,
) {
  const response = await fetch(getParseTaskEndpoint(config, taskId), {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error('查询文档解析状态失败')
  }

  return await response.json() as ParseTaskStatusResponse
}

async function pollParseTaskUntilCompleted(
  config: AgentFileApiConfig,
  taskId: string,
  options: {
    signal?: AbortSignal
    pollIntervalMs?: number
    maxPollAttempts?: number
  } = {},
) {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS

  // 这里保留前端轮询，是因为后端解析是异步任务；只有拿到 completed，前端才把附件视为真正可用。
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const task = await getParseTaskStatus(config, taskId, options.signal)
    const status = task.status?.toLowerCase()

    if (status === 'completed') {
      return task
    }

    if (status === 'failed') {
      throw new Error(task.error || '文档解析失败')
    }

    if (attempt < maxPollAttempts - 1) {
      await sleep(pollIntervalMs, options.signal)
    }
  }

  throw new Error('文档解析超时，请稍后重试')
}

export async function uploadPendingFileToOssWithDocumentParse(
  pendingFile: UploadedFile,
  file: File,
  options: UploadWithParseOptions = {},
): Promise<UploadedFile> {
  const uploadedFile = await uploadPendingFileToOss(pendingFile, file, options.onProgress)
  let parseTask: ParseTaskSubmission | null = null

  if (uploadedFile.status !== 'completed' || !uploadedFile.url) {
    return uploadedFile
  }

  if (!isDocumentFile(uploadedFile)) {
    return uploadedFile
  }

  try {
    const config = await loadAgentFileApiConfig()
    parseTask = await submitParseTask(config, uploadedFile, options.signal)

    const parsingFile: UploadedFile = {
      ...uploadedFile,
      status: 'parsing',
      parseTaskId: parseTask.task_id,
      resourceId: parseTask.resource_id,
    }
    options.onStatusChange?.(parsingFile)

    const completedTask = await pollParseTaskUntilCompleted(config, parseTask.task_id, {
      signal: options.signal,
      pollIntervalMs: options.pollIntervalMs,
      maxPollAttempts: options.maxPollAttempts,
    })

    return {
      ...uploadedFile,
      status: 'completed',
      parseTaskId: parseTask.task_id,
      resourceId: completedTask.resource_id || parseTask.resource_id,
    }
  } catch (error) {
    return {
      ...uploadedFile,
      status: 'error',
      parseTaskId: parseTask?.task_id,
      resourceId: parseTask?.resource_id,
      error: error instanceof Error ? error.message : '文档解析失败',
    }
  }
}
