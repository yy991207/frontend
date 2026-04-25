import { request } from './request'
import { getConfig } from '@/config/appConfig'

export interface ApiSection {
  section_id: string
  project_id: string
  team_id: string
  name: string
  is_default: boolean
  sort_order: number
  creator_id: string
  created_at: string
  updated_at: string
  is_deleted: boolean
}

export function listSections(projectId: string): Promise<ApiSection[]> {
  return request<ApiSection[]>(
    `api/v1/task-center/projects/${projectId}/sections` +
      `?user_id=${encodeURIComponent(getConfig().user_id)}`,
  )
}

export function createSection(
  projectId: string,
  name: string,
): Promise<ApiSection> {
  return request<ApiSection>(
    `api/v1/task-center/projects/${projectId}/sections`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: getConfig().user_id, name }),
    },
  )
}

export function updateSection(
  sectionId: string,
  name: string,
): Promise<ApiSection> {
  return request<ApiSection>(`api/v1/task-center/sections/${sectionId}`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: getConfig().user_id, name }),
  })
}

export function deleteSection(sectionId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/sections/${sectionId}` +
      `?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'DELETE' },
  )
}

export function updateSectionSortOrder(
  sectionId: string,
  sortOrder: number,
): Promise<void> {
  return request<void>(
    `api/v1/task-center/sections/${sectionId}/sort-order`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        user_id: getConfig().user_id,
        sort_order: sortOrder,
      }),
    },
  )
}

export function moveTaskToSection(
  taskId: string,
  sectionId: string,
): Promise<void> {
  return request<void>(`api/v1/task-center/tasks/${taskId}/section`, {
    method: 'PATCH',
    body: JSON.stringify({
      user_id: getConfig().user_id,
      section_id: sectionId,
    }),
  })
}

/**
 * Compute a new sort_order for a section moved from fromIndex to toIndex
 * within a sorted section array.
 */
export function computeSectionSortOrder(
  ordered: { section_id: string; sort_order: number }[],
  fromIndex: number,
  toIndex: number,
): number {
  const without = ordered.filter((_, i) => i !== fromIndex)
  const prev = toIndex > 0 ? without[toIndex - 1] : undefined
  const next = without[toIndex]
  if (!prev && !next) return 1024
  if (!prev) return next!.sort_order - 1024
  if (!next) return prev.sort_order + 1024
  return (prev.sort_order + next.sort_order) / 2
}
