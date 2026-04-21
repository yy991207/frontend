import { API_PATHS, buildAbsoluteApiUrl } from './apiEndpoints'

export type LibraryFileDetail = {
  file_id: string
  file_name: string
  agent_name: string
  agent_id: string | null
  session_id: string
  file_type: string
  file_path: string
  created_at: string
  file_url: string
  size_bytes: number | null
  skill_name: string
}

export async function fetchLibraryFileDetail(
  baseUrl: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<LibraryFileDetail> {
  const url = `${buildAbsoluteApiUrl(baseUrl, API_PATHS.library)}/${encodeURIComponent(fileId)}`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw new Error(`获取文件详情失败: HTTP ${response.status}`)
  }
  return response.json()
}

export type SaveToCloudDiskParams = {
  url: string
}

export type SaveToCloudDiskResponse = {
  success: boolean
  message: string
  code: number
  result: Record<string, unknown>
  timestamp: string | null
}

export async function saveToCloudDisk(
  baseUrl: string,
  token: string,
  userId: string,
  params: SaveToCloudDiskParams,
): Promise<SaveToCloudDiskResponse> {
  const url = buildAbsoluteApiUrl(baseUrl, API_PATHS.librarySaveToCloudDisk)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      access_token: token,
      user_id: userId,
      url: params.url,
    }),
  })
  if (!response.ok) {
    throw new Error('保存到云盘失败')
  }
  return response.json() as Promise<SaveToCloudDiskResponse>
}

export async function fetchPreviewContent(
  baseUrl: string,
  fileUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${buildAbsoluteApiUrl(baseUrl, API_PATHS.libraryFilePreview)}?url=${encodeURIComponent(fileUrl)}`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`获取预览内容失败: HTTP ${response.status}`)
  }
  return response.text()
}
