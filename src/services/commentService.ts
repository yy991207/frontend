import { getConfig } from '@/config/appConfig'
import { request } from './request'

export interface ApiComment {
  comment_id: string
  task_id: string
  author_id: string
  author_name?: string | null
  author_avatar_url?: string | null
  user_id?: string
  content: string
  mentions: string[] | null
  attachment_ids: string[] | null
  created_at: string
  updated_at: string
  is_deleted?: boolean
}

const uid = () => encodeURIComponent(getConfig().user_id)

export interface CommentPage {
  items: ApiComment[]
  total: number
  page: number
  page_size: number
}

export async function listComments(
  taskId: string,
  page = 1,
  pageSize = 50,
): Promise<ApiComment[]> {
  const qs = `user_id=${uid()}&page=${page}&page_size=${pageSize}`
  const res = await request<CommentPage | ApiComment[]>(
    `api/v1/task-center/tasks/${taskId}/comments?${qs}`,
  )
  if (Array.isArray(res)) return res
  return res?.items ?? []
}

export async function createComment(
  taskId: string,
  content: string,
  mentions?: string[],
  attachmentIds?: string[],
): Promise<ApiComment> {
  return request<ApiComment>(`api/v1/task-center/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: getConfig().user_id,
      content,
      mentions: mentions ?? null,
      attachment_ids: attachmentIds ?? null,
    }),
  })
}

export async function updateComment(
  taskId: string,
  commentId: string,
  content: string,
  mentions?: string[],
): Promise<ApiComment> {
  return request<ApiComment>(
    `api/v1/task-center/tasks/${taskId}/comments/${commentId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        user_id: getConfig().user_id,
        content,
        mentions: mentions ?? null,
      }),
    },
  )
}

export async function deleteComment(
  taskId: string,
  commentId: string,
): Promise<void> {
  return request<void>(
    `api/v1/task-center/tasks/${taskId}/comments/${commentId}?user_id=${uid()}`,
    { method: 'DELETE' },
  )
}
