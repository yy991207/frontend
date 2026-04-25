import { request } from './request'
import { getConfig } from '@/config/appConfig'
import type {
  Task,
  Priority,
  CustomFieldValue,
  TasklistRef,
  TaskCompletionMode,
  AssigneeCompletion,
} from '@/types/task'

export interface ApiUserProfile {
  user_id: string
  user_name?: string | null
  avatar_url?: string | null
}

export interface ApiTask {
  task_id: string
  project_id: string
  team_id: string
  parent_task_id: string | null
  depth: number
  title: string
  description: string | null
  status: string
  priority: string
  tags: string[]
  section_id: string
  creator_id: string
  creator_name?: string | null
  creator_avatar_url?: string | null
  assignee_id: string | null
  assignee_ids?: string[]
  assignees?: ApiUserProfile[]
  participant_ids: string[]
  follower_ids: string[]
  participants?: ApiUserProfile[]
  followers?: ApiUserProfile[]
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  completion_mode?: TaskCompletionMode | null
  assignee_completions?: AssigneeCompletion[]
  sort_order: number
  involved_user_ids: string[]
  attachment_count: number
  comment_count: number
  subtask_count: number
  created_at: string
  updated_at: string
  is_deleted: boolean
  is_completed: boolean
  is_starred: boolean
  custom_fields?: Record<string, unknown>
}

export interface ApiTaskActivity {
  activity_id: string
  task_id: string
  project_id: string
  team_id: string
  event_type: string
  actor_id: string
  involved_user_ids: string[]
  mentions: string[]
  payload: Record<string, unknown>
  created_at: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

const priorityStringToNum: Record<string, Priority> = {
  low: 1 as Priority,
  medium: 2 as Priority,
  high: 3 as Priority,
  urgent: 4 as Priority,
}

const priorityNumToString: Record<number, string> = {
  0: 'medium',
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'urgent',
}

function normalizeTaskCompletionMode(mode?: string | null): TaskCompletionMode {
  return mode === 'all' ? 'all' : 'any'
}

function normalizeTaskStatus(status: string, isCompleted: boolean): Task['status'] {
  if (isCompleted) {
    return 'done'
  }
  if (status === 'done' || status === 'in_progress' || status === 'cancelled') {
    return status
  }
  return 'todo'
}

function mapApiCustomFieldValue(fieldId: string, rawValue: unknown): CustomFieldValue | null {
  if (rawValue === null || rawValue === undefined) {
    return null
  }

  if (typeof rawValue === 'string') {
    return {
      guid: fieldId,
      text_value: rawValue,
      single_select_value: rawValue,
    }
  }

  if (typeof rawValue === 'number') {
    return {
      guid: fieldId,
      number_value: String(rawValue),
      datetime_value: String(rawValue),
    }
  }

  if (Array.isArray(rawValue)) {
    if (
      rawValue.every(
        (item) => typeof item === 'object' && item !== null && 'id' in item,
      )
    ) {
      return {
        guid: fieldId,
        member_value: rawValue.map((item) => {
          const member = item as { id: string; type?: 'user' | 'chat'; name?: string }
          return {
            id: member.id,
            type: member.type ?? 'user',
            name: member.name,
          }
        }),
      }
    }

    if (rawValue.every((item) => typeof item === 'string')) {
      return {
        guid: fieldId,
        multi_select_value: rawValue,
      }
    }
  }

  return {
    guid: fieldId,
    text_value: JSON.stringify(rawValue),
  }
}

function buildApiUserProfileMap(api: ApiTask): Map<string, ApiUserProfile> {
  const profileMap = new Map<string, ApiUserProfile>()
  const profileList = [
    ...(api.assignees ?? []),
    ...(api.participants ?? []),
    ...(api.followers ?? []),
  ]

  for (const profile of profileList) {
    if (!profile?.user_id) {
      continue
    }
    profileMap.set(profile.user_id, profile)
  }

  if (api.creator_id) {
    const currentProfile = profileMap.get(api.creator_id)
    profileMap.set(api.creator_id, {
      user_id: api.creator_id,
      user_name: api.creator_name ?? currentProfile?.user_name,
      avatar_url: api.creator_avatar_url ?? currentProfile?.avatar_url,
    })
  }

  return profileMap
}

export function apiTaskToTask(api: ApiTask, projectId?: string): Task {
  const apiAssigneeIds = Array.from(
    new Set([...(api.assignee_ids ?? []), ...(api.assignee_id ? [api.assignee_id] : [])]),
  )
  const profileMap = buildApiUserProfileMap(api)
  const assigneeCompletionMap = new Map(
    (api.assignee_completions ?? [])
      .filter((item) => item?.user_id)
      .map((item) => [item.user_id, item]),
  )
  const members = [
    ...apiAssigneeIds.map((id) => {
      const profile = profileMap.get(id)
      return {
        id,
        role: 'assignee' as const,
        type: 'user' as const,
        name: profile?.user_name ?? id,
        avatar: profile?.avatar_url ?? undefined,
      }
    }),
    ...[...api.participant_ids, ...api.follower_ids].map((id) => {
      const profile = profileMap.get(id)
      return {
        id,
        role: 'follower' as const,
        type: 'user' as const,
        name: profile?.user_name ?? id,
        avatar: profile?.avatar_url ?? undefined,
      }
    }),
  ]
  const creatorProfile = profileMap.get(api.creator_id)

  const tlGuid = projectId ?? api.project_id
  const mappedCustomFields = Object.entries(api.custom_fields ?? {})
    .map(([fieldId, rawValue]) => mapApiCustomFieldValue(fieldId, rawValue))
    .filter((item): item is CustomFieldValue => item !== null)

  return {
    guid: api.task_id,
    task_id: api.task_id,
    summary: api.title,
    description: api.description ?? '',
    status: normalizeTaskStatus(api.status, api.is_completed),
    completed_at: api.completed_at
      ? new Date(api.completed_at).getTime().toString()
      : '0',
    created_at: new Date(api.created_at).getTime().toString(),
    updated_at: new Date(api.updated_at).getTime().toString(),
    creator: {
      id: api.creator_id,
      type: 'user',
      name: api.creator_name ?? creatorProfile?.user_name ?? api.creator_id,
      avatar: api.creator_avatar_url ?? creatorProfile?.avatar_url ?? undefined,
    },
    mode: normalizeTaskCompletionMode(api.completion_mode) === 'all' ? 1 : 2,
    completion_mode: normalizeTaskCompletionMode(api.completion_mode),
    assignee_completions: apiAssigneeIds.map((id) => {
      const completion = assigneeCompletionMap.get(id)
      const profile = profileMap.get(id)
      return {
        user_id: id,
        is_completed: completion?.is_completed ?? api.is_completed,
        completed_at: completion?.completed_at ?? null,
        user_name: completion?.user_name ?? profile?.user_name ?? null,
        avatar_url: completion?.avatar_url ?? profile?.avatar_url ?? null,
      }
    }),
    priority: (priorityStringToNum[api.priority] ?? 0) as Priority,
    tags: [...api.tags],
    is_milestone: false,
    source: 1,
    parent_task_guid: api.parent_task_id ?? '',
    depth: api.depth,
    attachment_count: api.attachment_count,
    comment_count: api.comment_count,
    subtask_count: api.subtask_count,
    participant_ids: [...api.participant_ids],
    members,
    tasklists: [{ tasklist_guid: tlGuid, section_guid: api.section_id }],
    dependencies: [],
    custom_fields: mappedCustomFields,
    reminders: [],
    start: api.start_date
      ? { timestamp: new Date(api.start_date).getTime().toString(), is_all_day: false }
      : undefined,
    due: api.due_date
      ? { timestamp: new Date(api.due_date).getTime().toString(), is_all_day: false }
      : undefined,
    url: '',
  }
}

export function applyParticipantIdsToTask(task: Task, participantIds: string[]): Task {
  const nextParticipantIds = Array.from(new Set(participantIds.filter(Boolean)))
  const followerMembers = task.members.filter((member) => member.role === 'follower')
  const followerById = new Map(followerMembers.map((member) => [member.id, member]))
  const nextFollowerMembers = nextParticipantIds.map((id) => {
    const matched = followerById.get(id)
    return matched ?? { id, role: 'follower' as const, type: 'user' as const }
  })

  return {
    ...task,
    participant_ids: nextParticipantIds,
    members: [
      ...task.members.filter((member) => member.role !== 'follower'),
      ...nextFollowerMembers,
    ],
  }
}

export function buildDefaultParticipantIds(
  creatorId: string | undefined,
  assigneeIds: string[],
): string[] {
  return Array.from(
    new Set([creatorId, ...assigneeIds].filter((id): id is string => Boolean(id))),
  )
}

// ---- List / Get ----

export async function listTasks(params: {
  project_id?: string
  status?: string
  section_id?: string
  assignee_id?: string
  creator_id?: string
  involved_user_id?: string
  is_starred?: boolean
  keyword?: string
  sort_by?: string
  order?: string
  page?: number
  page_size?: number
}): Promise<{ items: ApiTask[]; total: number }> {
  const qs = new URLSearchParams({
    user_id: getConfig().user_id,
    team_id: getConfig().team_id,
  })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  }
  const resp = await request<PaginatedResponse<ApiTask>>(
    `api/v1/task-center/tasks?${qs}`,
  )
  return { items: resp.items, total: resp.total }
}

export function getTask(taskId: string): Promise<ApiTask> {
  return request<ApiTask>(
    `api/v1/task-center/tasks/${taskId}?user_id=${encodeURIComponent(getConfig().user_id)}`,
  )
}

export function listSubtasks(taskId: string): Promise<ApiTask[]> {
  return request<ApiTask[]>(
    `api/v1/task-center/tasks/${taskId}/subtasks?user_id=${encodeURIComponent(getConfig().user_id)}`,
  )
}

export async function listTaskActivities(
  taskId: string,
  page = 1,
  pageSize = 100,
): Promise<ApiTaskActivity[]> {
  const qs = new URLSearchParams()
  qs.set('user_id', getConfig().user_id)
  qs.set('page', String(page))
  qs.set('page_size', String(pageSize))
  const resp = await request<PaginatedResponse<ApiTaskActivity> | ApiTaskActivity[]>(
    `api/v1/task-center/tasks/${taskId}/activities?${qs}`,
  ) 
  return Array.isArray(resp) ? resp : resp.items
}

export async function listMyActivities(
  page = 1,
  pageSize = 20,
  eventTypes?: string[],
  since?: string,
): Promise<ApiTaskActivity[]> {
  const qs = new URLSearchParams()
  qs.set('user_id', getConfig().user_id)
  qs.set('page', String(page))
  qs.set('page_size', String(pageSize))
  if (eventTypes && eventTypes.length > 0) {
    qs.set('event_types', eventTypes.join(','))
  }
  if (since) {
    qs.set('since', since)
  }
  const resp = await request<PaginatedResponse<ApiTaskActivity> | ApiTaskActivity[]>(
    `api/v1/task-center/activities/me?${qs}`,
  )
  return Array.isArray(resp) ? resp : resp.items
}

// ---- Create / Update / Delete ----

export function createTaskApi(payload: {
  project_id: string
  title: string
  description?: string
  parent_task_id?: string
  assignee_ids?: string[]
  completion_mode?: TaskCompletionMode
  priority?: string
  tags?: string[]
  section_id?: string
  start_date?: string
  due_date?: string
}): Promise<ApiTask> {
  return request<ApiTask>('api/v1/task-center/tasks', {
    method: 'POST',
    body: JSON.stringify({ user_id: getConfig().user_id, ...payload }),
  })
}

export function updateTaskApi(
  taskId: string,
  patch: {
    title?: string
    description?: string
    description_mentions?: string[]
    parent_task_id?: string | null
    status?: string
    priority?: string
    assignee_ids?: string[]
    completion_mode?: TaskCompletionMode
    tags?: string[]
    section_id?: string | null
    tasklists?: TasklistRef[]
    start_date?: string | null
    due_date?: string | null
  },
): Promise<ApiTask> {
  return request<ApiTask>(`api/v1/task-center/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: getConfig().user_id, ...patch }),
  })
}

export function deleteTaskApi(taskId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/tasks/${taskId}?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'DELETE' },
  )
}

// ---- Patch endpoints ----

export function patchTaskStatus(
  taskId: string,
  status: string,
  options?: { scope?: 'self' | 'all' },
): Promise<ApiTask> {
  return request<ApiTask>(`api/v1/task-center/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: getConfig().user_id, status, ...options }),
  })
}

export function patchTaskAssignee(
  taskId: string,
  assigneeIds: string[],
): Promise<ApiTask> {
  return request<ApiTask>(`api/v1/task-center/tasks/${taskId}/assignee`, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: getConfig().user_id, assignee_ids: assigneeIds }),
  })
}

export function patchTaskSortOrder(
  taskId: string,
  sortOrder: number,
): Promise<void> {
  return request<void>(`api/v1/task-center/tasks/${taskId}/sort-order`, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: getConfig().user_id, sort_order: sortOrder }),
  })
}

// ---- Participants / Followers ----

export function addParticipants(
  taskId: string,
  userIds: string[],
): Promise<void> {
  return request<void>(`api/v1/task-center/tasks/${taskId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ user_id: getConfig().user_id, user_ids: userIds }),
  })
}

export function removeParticipant(
  taskId: string,
  targetUserId: string,
): Promise<void> {
  return request<void>(
    `api/v1/task-center/tasks/${taskId}/participants/${targetUserId}?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'DELETE' },
  )
}

export function addFollower(taskId: string): Promise<void> {
  return request<void>(`api/v1/task-center/tasks/${taskId}/followers`, {
    method: 'POST',
    body: JSON.stringify({ user_id: getConfig().user_id }),
  })
}

export function removeFollower(taskId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/tasks/${taskId}/followers?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'DELETE' },
  )
}

// ---- Star ----

export function starTask(taskId: string): Promise<void> {
  return request<void>(`api/v1/task-center/tasks/${taskId}/star`, {
    method: 'POST',
    body: JSON.stringify({ user_id: getConfig().user_id }),
  })
}

export function unstarTask(taskId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/tasks/${taskId}/star?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'DELETE' },
  )
}

// ---- Batch ----

export function batchTasks(payload: {
  task_ids: string[]
  action: string
  status?: string
  assignee_ids?: string[]
  priority?: string
  tags?: string[]
}): Promise<void> {
  return request<void>('api/v1/task-center/tasks/batch', {
    method: 'POST',
    body: JSON.stringify({ user_id: getConfig().user_id, ...payload }),
  })
}

// ---- Helpers ----

export async function cancelTask(
  taskId: string,
  opts?: { terminate?: boolean; signal?: string },
): Promise<void> {
  const qs: string[] = []
  if (typeof opts?.terminate === 'boolean') qs.push(`terminate=${opts.terminate}`)
  if (opts?.signal) qs.push(`signal=${encodeURIComponent(opts.signal)}`)
  const suffix = qs.length ? `?${qs.join('&')}` : ''
  return request<void>(`api/v1/tasks/${taskId}/cancel${suffix}`, {
    method: 'POST',
  })
}

export function toPriorityString(p: number): string {
  return priorityNumToString[p] ?? 'medium'
}
