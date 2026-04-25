import { request } from './request'
import { getConfig } from '@/config/appConfig'
import type { Project } from '@/types/project'

export interface ProjectSummaryDistributionItem {
  key: string
  label: string
  count: number
  [key: string]: unknown
}

export interface ProjectSummary {
  priority_distribution: ProjectSummaryDistributionItem[]
  status_distribution: ProjectSummaryDistributionItem[]
  [key: string]: unknown
}

export function listProjects(params?: {
  status?: 'active' | 'archived'
  group_id?: string
}): Promise<Project[]> {
  const qs = new URLSearchParams({
    user_id: getConfig().user_id,
    team_id: getConfig().team_id,
  })
  if (params?.status) qs.set('status', params.status)
  if (params?.group_id) qs.set('group_id', params.group_id)
  return request<Project[]>(`api/v1/task-center/projects?${qs}`)
}

export function getProject(projectId: string): Promise<Project> {
  return request<Project>(
    `api/v1/task-center/projects/${projectId}?user_id=${encodeURIComponent(getConfig().user_id)}`,
  )
}

export function createProject(
  name: string,
  groupId?: string,
  description?: string,
): Promise<Project> {
  return request<Project>('api/v1/task-center/projects', {
    method: 'POST',
    body: JSON.stringify({
      user_id: getConfig().user_id,
      team_id: getConfig().team_id,
      name,
      ...(groupId ? { group_id: groupId } : {}),
      ...(description ? { description } : {}),
    }),
  })
}

export function updateProject(
  projectId: string,
  patch: { name?: string; description?: string },
): Promise<Project> {
  return request<Project>(
    `api/v1/task-center/projects/${projectId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ user_id: getConfig().user_id, ...patch }),
    },
  )
}

export function deleteProject(projectId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/projects/${projectId}?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'DELETE' },
  )
}

export function archiveProject(projectId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/projects/${projectId}/archive?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'POST' },
  )
}

export function moveProjectToGroup(
  projectId: string,
  groupId: string,
): Promise<void> {
  return request<void>(
    `api/v1/task-center/projects/${projectId}/group`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        user_id: getConfig().user_id,
        group_id: groupId,
      }),
    },
  )
}

export function distributeProject(
  projectId: string,
  targetTeamIds: string[],
): Promise<void> {
  return request<void>(
    `api/v1/task-center/projects/${projectId}/distribute`,
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: getConfig().user_id,
        target_team_ids: targetTeamIds,
      }),
    },
  )
}

export function getProjectSummary(projectId: string): Promise<ProjectSummary> {
  return request<ProjectSummary>(
    `api/v1/task-center/projects/${projectId}/summary?user_id=${encodeURIComponent(getConfig().user_id)}`,
  )
}
