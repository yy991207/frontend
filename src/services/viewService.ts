import { request } from './request'
import { getConfig } from '@/config/appConfig'

export type ViewScope = 'shared' | 'personal'
type ApiViewScope = ViewScope | 'team'

export interface TaskView {
  view_id: string
  project_id: string
  name: string
  scope: ViewScope
  filters: ViewFilters
  creator_id?: string
  sort_order?: number
  created_at?: string
  updated_at?: string
}

export interface ViewFilters {
  version?: number
  statusFilter?: 'all' | 'todo' | 'done'
  sortMode?: 'custom' | 'due' | 'start' | 'created'
  groupMode?: string
  filterConditions?: unknown[]
  [key: string]: unknown
}

export const DEFAULT_VIEW_NAME = '默认视图'

function normalizeViewScope(scope: ApiViewScope | undefined): ViewScope {
  return scope === 'team' || scope === 'shared' ? 'shared' : 'personal'
}

function normalizeTaskView(view: Omit<TaskView, 'scope'> & { scope: ApiViewScope }): TaskView {
  // 后端灰度期间可能还会返回旧值 team，这里统一规整成 shared，避免页面各处重复兼容。
  return {
    ...view,
    scope: normalizeViewScope(view.scope),
  }
}

export async function listViews(projectId: string): Promise<TaskView[]> {
  const qs = new URLSearchParams({ user_id: getConfig().user_id })
  const views = await request<Array<Omit<TaskView, 'scope'> & { scope: ApiViewScope }>>(
    `api/v1/task-center/projects/${projectId}/views?${qs}`,
  )
  return views.map(normalizeTaskView)
}

export async function getView(viewId: string): Promise<TaskView> {
  const qs = new URLSearchParams({ user_id: getConfig().user_id })
  const view = await request<Omit<TaskView, 'scope'> & { scope: ApiViewScope }>(
    `api/v1/task-center/views/${viewId}?${qs}`,
  )
  return normalizeTaskView(view)
}

export async function createView(
  projectId: string,
  body: { name: string; scope?: ViewScope; filters: ViewFilters },
): Promise<TaskView> {
  const view = await request<Omit<TaskView, 'scope'> & { scope: ApiViewScope }>(`api/v1/task-center/projects/${projectId}/views`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: getConfig().user_id,
      name: body.name,
      scope: normalizeViewScope(body.scope),
      filters: body.filters,
    }),
  })
  return normalizeTaskView(view)
}

export async function updateView(
  viewId: string,
  body: { name?: string; scope?: ViewScope; filters?: ViewFilters },
): Promise<TaskView> {
  const normalizedBody = body.scope === undefined
    ? body
    : {
        ...body,
        scope: normalizeViewScope(body.scope),
      }
  const view = await request<Omit<TaskView, 'scope'> & { scope: ApiViewScope }>(`api/v1/task-center/views/${viewId}`, {
    method: 'PUT',
    body: JSON.stringify({
      user_id: getConfig().user_id,
      ...normalizedBody,
    }),
  })
  return normalizeTaskView(view)
}

export function deleteView(viewId: string): Promise<void> {
  const qs = new URLSearchParams({ user_id: getConfig().user_id })
  return request<void>(
    `api/v1/task-center/views/${viewId}?${qs}`,
    { method: 'DELETE' },
  )
}
