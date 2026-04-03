import { buildArtifactDownloadUrl, buildPreviewApiUrl } from './utils'

export async function loadArtifactContent({
  baseUrl,
  sessionId,
  filepath,
  signal,
}: {
  baseUrl: string
  sessionId: string
  filepath: string
  signal?: AbortSignal
}): Promise<string> {
  const url = buildArtifactDownloadUrl({ baseUrl, sessionId, filepath })
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`Failed to load artifact content: ${filepath}`)
  }

  return response.text()
}

export async function loadPreviewContent({
  baseUrl,
  sessionId,
  url,
  signal,
}: {
  baseUrl: string
  sessionId: string
  url: string
  signal?: AbortSignal
}): Promise<string> {
  const apiUrl = buildPreviewApiUrl({ baseUrl, sessionId, url })
  const response = await fetch(apiUrl, { signal })

  if (!response.ok) {
    throw new Error(`Failed to load preview content: ${url}`)
  }

  return response.text()
}
