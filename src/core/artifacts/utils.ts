export function buildArtifactDownloadUrl({
  baseUrl,
  sessionId,
  filepath,
  download = false,
}: {
  baseUrl: string
  sessionId: string
  filepath: string
  download?: boolean
}): string {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '')
  const mode = download ? 'download' : 'inline'
  return `${cleanBaseUrl}/api/v1/chat/sessions/${sessionId}/files/download?path=${encodeURIComponent(filepath)}&mode=${mode}`
}

export function buildArtifactPreviewUrl({
  baseUrl,
  sessionId,
  filepath,
}: {
  baseUrl: string
  sessionId: string
  filepath: string
}): string {
  return buildArtifactDownloadUrl({ baseUrl, sessionId, filepath, download: false })
}

export function buildPreviewApiUrl({
  baseUrl,
  sessionId,
  url,
}: {
  baseUrl: string
  sessionId: string
  url: string
}): string {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '')
  return `${cleanBaseUrl}/api/v1/chat/sessions/${sessionId}/files/preview?session_id=${encodeURIComponent(sessionId)}&url=${encodeURIComponent(url)}`
}
