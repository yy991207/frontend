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
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '')
  const url = `${cleanBaseUrl}/api/v1/files/library/${fileId}`
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

export async function fetchPreviewContent(
  baseUrl: string,
  fileUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '')
  const url = `${cleanBaseUrl}/api/v1/chat/files/preview?url=${encodeURIComponent(fileUrl)}`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`获取预览内容失败: HTTP ${response.status}`)
  }
  return response.text()
}