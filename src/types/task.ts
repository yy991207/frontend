export const Priority = {
  None: 0,
  Low: 1,
  Medium: 2,
  High: 3,
  Urgent: 4,
} as const
export type Priority = (typeof Priority)[keyof typeof Priority]

export const PriorityLabel: Record<Priority, string> = {
  [Priority.None]: '无',
  [Priority.Low]: '低',
  [Priority.Medium]: '中',
  [Priority.High]: '高',
  [Priority.Urgent]: '紧急',
}

export const PriorityColor: Record<Priority, string> = {
  [Priority.None]: '#bfbfbf',
  [Priority.Low]: '#1677ff',
  [Priority.Medium]: '#faad14',
  [Priority.High]: '#fa8c16',
  [Priority.Urgent]: '#f5222d',
}

export type MemberRole = 'assignee' | 'follower'
export type MemberType = 'user' | 'app' | 'chat'

export interface Member {
  id: string
  role: MemberRole
  type: MemberType
  name?: string
  avatar?: string
}

export interface TimeValue {
  timestamp: string
  is_all_day: boolean
}

export interface Reminder {
  relative_fire_minute: number
}

export type TaskCompletionMode = 'any' | 'all'

export interface AssigneeCompletion {
  user_id: string
  is_completed: boolean
  completed_at?: string | null
  user_name?: string | null
  avatar_url?: string | null
}

export interface TasklistRef {
  tasklist_guid: string
  section_guid: string
}

export interface Dependency {
  task_guid: string
  type: 'prev' | 'next'
}

export type CustomFieldType =
  | 'number'
  | 'member'
  | 'datetime'
  | 'date'
  | 'single_select'
  | 'select'
  | 'multi_select'
  | 'text'

export interface SelectOption {
  guid: string
  name: string
  color?: string | null
  is_disabled?: boolean
  disabled_at?: string | null
}

export interface CustomFieldDef {
  guid: string
  name: string
  type: CustomFieldType
  options?: SelectOption[]
}

export interface CustomFieldValue {
  guid: string
  number_value?: string
  text_value?: string
  datetime_value?: string
  single_select_value?: string
  multi_select_value?: string[]
  member_value?: { id: string; type: MemberType; name?: string }[]
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskMode = 1 | 2 // 1=会签, 2=或签

export interface Task {
  guid: string
  task_id: string
  summary: string
  description: string
  status: TaskStatus
  completed_at: string
  created_at: string
  updated_at: string
  creator: { id: string; type: MemberType; name?: string; avatar?: string }
  mode: TaskMode
  completion_mode?: TaskCompletionMode
  assignee_completions?: AssigneeCompletion[]
  priority: Priority
  tags: string[]
  is_milestone: boolean
  source: number
  parent_task_guid: string
  depth?: number
  attachment_count: number
  comment_count: number
  subtask_count: number
  participant_ids?: string[]
  members: Member[]
  tasklists: TasklistRef[]
  dependencies: Dependency[]
  custom_fields: CustomFieldValue[]
  reminders: Reminder[]
  due?: TimeValue
  start?: TimeValue
  url: string
}

export interface Section {
  guid: string
  name: string
  defaultCollapsed?: boolean
  sort_order?: number
  is_default?: boolean
}

export interface Tasklist {
  guid: string
  name: string
  display_color?: string
  owner: { id: string; type: MemberType }
  creator: { id: string; type: MemberType }
  members: Member[]
  sections: Section[]
  custom_fields: CustomFieldDef[]
  archive_msec: string
  created_at: string
  updated_at: string
  url: string
}

export interface User {
  id: string
  name: string
  avatar?: string
}

export interface CreateTaskPayload {
  summary: string
  description?: string
  members?: Omit<Member, 'name'>[]
  due?: TimeValue
  start?: TimeValue
  mode?: TaskMode
  completion_mode?: TaskCompletionMode
  priority?: Priority
  is_milestone?: boolean
  parent_task_guid?: string
  reminders?: Reminder[]
  tasklists?: TasklistRef[]
  custom_fields?: CustomFieldValue[]
}
