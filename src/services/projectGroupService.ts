import { request } from './request'
import { getConfig } from '@/config/appConfig'
import type { ProjectGroup } from '@/types/projectGroup'

export function listProjectGroups(): Promise<ProjectGroup[]> {
  return request<ProjectGroup[]>(
    `api/v1/task-center/teams/${getConfig().team_id}/project-groups` +
      `?user_id=${encodeURIComponent(getConfig().user_id)}`,
  )
}

export function createProjectGroup(name: string): Promise<ProjectGroup> {
  return request<ProjectGroup>(
    `api/v1/task-center/teams/${getConfig().team_id}/project-groups`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: getConfig().user_id, name }),
    },
  )
}

export function updateProjectGroup(groupId: string, name: string): Promise<ProjectGroup> {
  return request<ProjectGroup>(
    `api/v1/task-center/project-groups/${groupId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ user_id: getConfig().user_id, name }),
    },
  )
}

export function deleteProjectGroup(groupId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/project-groups/${groupId}` +
      `?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'DELETE' },
  )
}

export function updateGroupSortOrder(
  groupId: string,
  sortOrder: number,
): Promise<void> {
  return request<void>(
    `api/v1/task-center/project-groups/${groupId}/sort-order`,
    {
      method: 'PATCH',
      body: JSON.stringify({ user_id: getConfig().user_id, sort_order: sortOrder }),
    },
  )
}

export function computeDropSortOrder(
  ordered: ProjectGroup[],
  fromIndex: number,
  toIndex: number,
): number {
  const without = ordered.filter((_, i) => i !== fromIndex)
  const prev = toIndex > 0 ? without[toIndex - 1] : undefined
  const next = without[toIndex] as ProjectGroup | undefined
  if (!prev && !next) return 1024
  if (!prev) return next!.sort_order - 1024
  if (!next) return prev.sort_order + 1024
  return (prev.sort_order + next.sort_order) / 2
}
