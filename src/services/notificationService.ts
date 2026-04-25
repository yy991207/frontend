import { getConfig } from '@/config/appConfig'
import { request } from './request'

export interface ApiNotification {
  notification_id: string
  user_id: string
  type: string
  title: string
  content: string
  ref_type?: string | null
  ref_id?: string | null
  is_read: boolean
  created_at: string
}

export interface NotificationPage {
  items: ApiNotification[]
  total: number
  page: number
  page_size: number
  unread_count?: number
}

const uid = () => encodeURIComponent(getConfig().user_id)

export async function listNotifications(params?: {
  isRead?: boolean
  page?: number
  pageSize?: number
}): Promise<NotificationPage> {
  const qs: string[] = [`user_id=${uid()}`]
  if (typeof params?.isRead === 'boolean') qs.push(`is_read=${params.isRead}`)
  qs.push(`page=${params?.page ?? 1}`)
  qs.push(`page_size=${params?.pageSize ?? 20}`)
  const res = await request<NotificationPage | ApiNotification[]>(
    `api/v1/task-center/notifications?${qs.join('&')}`,
  )
  if (Array.isArray(res)) {
    return { items: res, total: res.length, page: 1, page_size: res.length }
  }
  return res
}

export async function getUnreadCount(): Promise<number> {
  const res = await request<{ count?: number; unread_count?: number } | number>(
    `api/v1/task-center/notifications/unread-count?user_id=${uid()}`,
  )
  if (typeof res === 'number') return res
  return res?.unread_count ?? res?.count ?? 0
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/notifications/${notificationId}/read?user_id=${uid()}`,
    { method: 'POST' },
  )
}

export async function markAllNotificationsRead(): Promise<void> {
  return request<void>(
    `api/v1/task-center/notifications/read-all?user_id=${uid()}`,
    { method: 'POST' },
  )
}

export async function deleteNotification(notificationId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/notifications/${notificationId}?user_id=${uid()}`,
    { method: 'DELETE' },
  )
}
