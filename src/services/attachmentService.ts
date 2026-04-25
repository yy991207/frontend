import { getConfig } from '@/config/appConfig'
import { request } from './request'
import { getAuthHeaders } from '../utils/http'

export interface ApiAttachment {
  attachment_id: string
  owner_type?: string
  owner_id?: string
  task_id: string
  team_id?: string
  file_name: string
  file_ext?: string | null
  file_size: number
  mime_type?: string | null
  content_type?: string | null
  is_image?: boolean
  url?: string | null
  final_url?: string | null
  file_url?: string | null
  download_url?: string | null
  oss_key?: string | null
  oss_bucket?: string | null
  resource_id: string | null
  uploader_id: string
  status?: string
  created_at: string
  updated_at?: string
  is_deleted?: boolean
}

export interface PresignAttachmentResponse {
  attachment_id: string
  upload_url: string
  upload_headers: Record<string, string>
  oss_key: string
  expires_in: number
  final_url: string
}

export type AttachmentOwnerType = 'task' | 'comment'

const uid = () => encodeURIComponent(getConfig().user_id)

export async function listAttachments(taskId: string): Promise<ApiAttachment[]> {
  return request<ApiAttachment[]>(
    `api/v1/task-center/tasks/${taskId}/attachments?user_id=${uid()}`,
  )
}

export async function getAttachment(attachmentId: string): Promise<ApiAttachment> {
  return request<ApiAttachment>(
    `api/v1/task-center/attachments/${attachmentId}?user_id=${uid()}`,
  )
}

export async function presignAttachment(
  taskId: string,
  file: File,
  ownerType: AttachmentOwnerType = 'task',
): Promise<PresignAttachmentResponse> {
  return request<PresignAttachmentResponse>(
    `api/v1/task-center/tasks/${taskId}/attachments/presign`,
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: getConfig().user_id,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || undefined,
        owner_type: ownerType,
      }),
    },
  )
}

export async function completeAttachment(
  attachmentId: string,
): Promise<ApiAttachment> {
  return request<ApiAttachment>(
    `api/v1/task-center/attachments/${attachmentId}/complete?user_id=${uid()}`,
    { method: 'POST' },
  )
}

async function putFileToOss(
  file: File,
  uploadUrl: string,
  uploadHeaders: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    Object.entries(uploadHeaders ?? {}).forEach(([k, v]) => {
      xhr.setRequestHeader(k, v)
    })
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`OSS 上传失败 (HTTP ${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('OSS 上传网络错误'))
    xhr.send(file)
  })
}

/**
 * 三步上传：presign -> PUT OSS -> complete
 */
export async function uploadAttachment(
  taskId: string,
  file: File,
  options?: {
    ownerType?: AttachmentOwnerType
    onProgress?: (percent: number) => void
  },
): Promise<ApiAttachment> {
  const ownerType = options?.ownerType ?? 'task'
  const presigned = await presignAttachment(taskId, file, ownerType)
  await putFileToOss(file, presigned.upload_url, presigned.upload_headers, options?.onProgress)
  const completed = await completeAttachment(presigned.attachment_id)
  return {
    ...completed,
    final_url: completed.final_url ?? completed.url ?? presigned.final_url,
  }
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/attachments/${attachmentId}?user_id=${uid()}`,
    { method: 'DELETE' },
  )
}

export function buildAttachmentDownloadUrl(attachmentId: string): string {
  const base = getConfig().url.replace(/\/+$/, '')
  return `${base}/api/v1/task-center/attachments/${attachmentId}/download?user_id=${uid()}`
}

export function buildAttachmentPreviewUrl(attachment: ApiAttachment): string {
  const base = getConfig().url.replace(/\/+$/, '')
  return `${base}/api/v1/chat/files/preview?url=${encodeURIComponent(
    getAttachmentPreviewSourceUrl(attachment),
  )}`
}

function getAttachmentPreviewSourceUrl(attachment: ApiAttachment): string {
  return (
    attachment.download_url ||
    attachment.url ||
    attachment.file_url ||
    attachment.final_url ||
    buildAttachmentDownloadUrl(attachment.attachment_id)
  )
}

export function isImageAttachment(attachment: ApiAttachment | null | undefined): boolean {
  if (!attachment) {
    return false
  }

  if (attachment.is_image === true) {
    return true
  }

  if (attachment.content_type?.startsWith('image/')) {
    return true
  }

  if (attachment.mime_type?.startsWith('image/')) {
    return true
  }

  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachment.file_name)
}

export async function downloadAttachment(
  attachmentId: string,
  fileName?: string,
): Promise<void> {
  const url = buildAttachmentDownloadUrl(attachmentId)
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) {
    throw new Error(`下载失败 (${res.status})`)
  }
  const blob = await res.blob()
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = fileName ?? 'attachment'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objUrl)
}
