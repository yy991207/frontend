import type {
  Task,
  Tasklist,
  User,
  CreateTaskPayload,
  Priority,
  Section,
} from '@/types/task'

const users: User[] = [
  { id: 'ou_001', name: '杨金玮' },
  { id: 'ou_002', name: '张洪磊' },
  { id: 'ou_003', name: '朱永' },
  { id: 'ou_004', name: '金林峰' },
  { id: 'ou_005', name: '张容恒' },
]

let tasklists: Tasklist[] = [
  {
    guid: 'tl_001',
    name: '果仁-人工智能通识培训',
    owner: { id: 'ou_001', type: 'user' },
    creator: { id: 'ou_001', type: 'user' },
    members: [],
    sections: [
      { guid: 'sec_001', name: '默认分组', defaultCollapsed: true },
      { guid: 'sec_002', name: '三方集成（正式）' },
      { guid: 'sec_003', name: '首页&工作台' },
    ],
    custom_fields: [],
    archive_msec: '0',
    created_at: '1713100000000',
    updated_at: '1713100000000',
    url: '',
  },
  {
    guid: 'tl_002',
    name: '任务清单 1',
    owner: { id: 'ou_001', type: 'user' },
    creator: { id: 'ou_001', type: 'user' },
    members: [],
    sections: [
      { guid: 'sec_101', name: '默认分组' },
    ],
    custom_fields: [],
    archive_msec: '0',
    created_at: '1710754080000',
    updated_at: '1710754080000',
    url: '',
  },
]

const sampleTasks: Task[] = [
  {
    guid: 'task_001',
    task_id: 't100001',
    summary: '转为在线文档',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1712937600000',
    updated_at: '1712937600000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 3 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 1,
    members: [
      { id: 'ou_002', role: 'assignee', type: 'user', name: '张洪磊' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_002',
    task_id: 't100002',
    summary: '智能体"公开"功能',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1713020400000',
    updated_at: '1713020400000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 3 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [
      { id: 'ou_002', role: 'assignee', type: 'user', name: '张洪磊' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_003',
    task_id: 't100003',
    summary: '指令',
    description: '',
    status: 'done',
    completed_at: '1713093600000',
    created_at: '1713093600000',
    updated_at: '1713093600000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [
      { id: 'ou_002', role: 'assignee', type: 'user', name: '张洪磊' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_004',
    task_id: 't100004',
    summary: '智能体附件输入',
    description: '',
    status: 'done',
    completed_at: '1712937600000',
    created_at: '1712937600000',
    updated_at: '1712937600000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [
      { id: 'ou_002', role: 'assignee', type: 'user', name: '张洪磊' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_005',
    task_id: 't100005',
    summary: '腾讯互动白板（待定）',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1710064500000',
    updated_at: '1710064500000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 1,
    members: [
      { id: 'ou_002', role: 'assignee', type: 'user', name: '张洪磊' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_006',
    task_id: 't100006',
    summary: '统计分析',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1712894100000',
    updated_at: '1712894100000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [
      { id: 'ou_004', role: 'assignee', type: 'user', name: '金林峰' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    start: { timestamp: '1712894100000', is_all_day: false },
    url: '',
  },
  {
    guid: 'task_007',
    task_id: 't100007',
    summary: 'IM+智能体',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1712890500000',
    updated_at: '1712890500000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [
      { id: 'ou_001', role: 'assignee', type: 'user', name: '杨金玮' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_003' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_008',
    task_id: 't100008',
    summary: '任务测试1',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1710754080000',
    updated_at: '1710754080000',
    creator: { id: 'ou_001', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [
      { id: 'ou_001', role: 'assignee', type: 'user', name: '杨金玮' },
    ],
    tasklists: [],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_009',
    task_id: 't100009',
    summary: '互动课堂（研讨会）',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1712891100000',
    updated_at: '1712891100000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 3,
    members: [
      { id: 'ou_002', role: 'assignee', type: 'user', name: '张洪磊' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_010',
    task_id: 't100010',
    summary: 'onlyoffice',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1712891300000',
    updated_at: '1712891300000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [
      { id: 'ou_001', role: 'assignee', type: 'user', name: '杨金玮' },
    ],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_011',
    task_id: 't100011',
    summary: '在线文档',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1712891500000',
    updated_at: '1712891500000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 1,
    members: [],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_002' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_012',
    task_id: 't100012',
    summary: '租户首页',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1712880000000',
    updated_at: '1712880000000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_003' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
  {
    guid: 'task_013',
    task_id: 't100013',
    summary: '用户工作台',
    description: '',
    status: 'todo',
    completed_at: '0',
    created_at: '1712880200000',
    updated_at: '1712880200000',
    creator: { id: 'ou_002', type: 'user' },
    mode: 2,
    priority: 0 as Priority,
    tags: [],
    is_milestone: false,
    source: 1,
    parent_task_guid: '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: [],
    tasklists: [{ tasklist_guid: 'tl_001', section_guid: 'sec_003' }],
    dependencies: [],
    custom_fields: [],
    reminders: [],
    url: '',
  },
]

let tasks: Task[] = [...sampleTasks]
let nextTaskNum = 20

function cloneTasklist(tasklist: Tasklist): Tasklist {
  return {
    ...tasklist,
    owner: { ...tasklist.owner },
    creator: { ...tasklist.creator },
    members: tasklist.members.map((member) => ({ ...member })),
    sections: tasklist.sections.map((section) => ({ ...section })),
    custom_fields: tasklist.custom_fields.map((field) => ({
      ...field,
      options: field.options?.map((option) => ({ ...option })),
    })),
  }
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    creator: { ...task.creator },
    tags: [...task.tags],
    members: task.members.map((member) => ({ ...member })),
    tasklists: task.tasklists.map((item) => ({ ...item })),
    dependencies: task.dependencies.map((item) => ({ ...item })),
    custom_fields: task.custom_fields.map((field) => ({
      ...field,
      multi_select_value: field.multi_select_value
        ? [...field.multi_select_value]
        : undefined,
      member_value: field.member_value?.map((member) => ({ ...member })),
    })),
    reminders: task.reminders.map((item) => ({ ...item })),
    start: task.start ? { ...task.start } : undefined,
    due: task.due ? { ...task.due } : undefined,
  }
}

function generateGuid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchUsers(): Promise<User[]> {
  await delay(50)
  return users.map((user) => ({ ...user }))
}

export function getCurrentUser(): User {
  return users[0]
}

export function getUserById(userId: string): User | undefined {
  return users.find((user) => user.id === userId)
}

export function getTaskByGuid(taskGuid: string): Task | undefined {
  const task = tasks.find((item) => item.guid === taskGuid)
  return task ? cloneTask(task) : undefined
}

export async function fetchTasklists(): Promise<Tasklist[]> {
  await delay(50)
  return tasklists.map(cloneTasklist)
}

export async function createTasklist(name: string): Promise<Tasklist> {
  await delay(200)
  const now = Date.now().toString()
  const tl: Tasklist = {
    guid: generateGuid('tl'),
    name,
    display_color: '#3370ff',
    owner: { id: 'ou_001', type: 'user' },
    creator: { id: 'ou_001', type: 'user' },
    members: [],
    sections: [{ guid: generateGuid('sec'), name: '默认分组' }],
    custom_fields: [],
    archive_msec: '0',
    created_at: now,
    updated_at: now,
    url: '',
  }
  tasklists = [...tasklists, tl]
  return cloneTasklist(tl)
}

export async function createTasklistWithOptions(payload: {
  name: string
  color?: string
  memberIds?: string[]
}): Promise<Tasklist> {
  const tasklist = await createTasklist(payload.name)
  if (!payload.memberIds?.length) {
    return tasklist
  }

  const nextTasklist: Tasklist = {
    ...tasklist,
    display_color: payload.color ?? tasklist.display_color,
    members: payload.memberIds
      .map((memberId) => users.find((user) => user.id === memberId))
      .filter((member): member is User => Boolean(member))
      .map((member) => ({
        id: member.id,
        type: 'user' as const,
        role: 'follower' as const,
        name: member.name,
      })),
  }

  tasklists = tasklists.map((item) => (item.guid === tasklist.guid ? nextTasklist : item))
  return cloneTasklist(nextTasklist)
}

export async function updateTasklist(
  guid: string,
  patch: Partial<Pick<Tasklist, 'name' | 'display_color' | 'members' | 'sections' | 'custom_fields'>>,
): Promise<Tasklist> {
  await delay(100)
  const tasklistIndex = tasklists.findIndex((tasklist) => tasklist.guid === guid)
  if (tasklistIndex === -1) {
    throw new Error('tasklist not found')
  }

  tasklists[tasklistIndex] = {
    ...tasklists[tasklistIndex],
    ...patch,
    updated_at: Date.now().toString(),
  }

  return cloneTasklist(tasklists[tasklistIndex])
}

export async function fetchTasks(): Promise<Task[]> {
  await delay(50)
  return tasks.map(cloneTask)
}

export async function fetchTasksByTasklist(tasklistGuid: string): Promise<Task[]> {
  await delay(50)
  return tasks
    .filter((t) => t.tasklists.some((ref) => ref.tasklist_guid === tasklistGuid))
    .map(cloneTask)
}

export async function fetchTasksByRole(
  role: 'assignee' | 'follower',
  userId: string,
): Promise<Task[]> {
  await delay(50)
  return tasks
    .filter((t) => t.members.some((m) => m.role === role && m.id === userId))
    .map(cloneTask)
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  await delay(150)
  const now = Date.now().toString()
  const currentUser = getCurrentUser()
  const task: Task = {
    guid: generateGuid('task'),
    task_id: `t${100000 + nextTaskNum++}`,
    summary: payload.summary,
    description: payload.description ?? '',
    status: 'todo',
    completed_at: '0',
    created_at: now,
    updated_at: now,
    creator: { id: currentUser.id, type: 'user' },
    mode: payload.mode ?? 2,
    priority: (payload.priority ?? 0) as Priority,
    tags: [],
    is_milestone: payload.is_milestone ?? false,
    source: 1,
    parent_task_guid: payload.parent_task_guid ?? '',
    attachment_count: 0,
    comment_count: 0,
    subtask_count: 0,
    members: (payload.members ?? []).map((m) => ({
      ...m,
      type: m.type ?? ('user' as const),
      name: users.find((u) => u.id === m.id)?.name,
    })) as Task['members'],
    tasklists: payload.tasklists ?? [],
    dependencies: [],
    custom_fields: payload.custom_fields ?? [],
    reminders: payload.reminders ?? [],
    due: payload.due,
    start: payload.start,
    url: '',
  }
  tasks = [task, ...tasks]
  if (payload.parent_task_guid) {
    const parentIndex = tasks.findIndex((item) => item.guid === payload.parent_task_guid)
    if (parentIndex !== -1) {
      tasks[parentIndex] = {
        ...tasks[parentIndex],
        subtask_count: tasks[parentIndex].subtask_count + 1,
        updated_at: now,
      }
    }
  }
  return cloneTask(task)
}

export async function updateTask(
  guid: string,
  patch: Partial<Task>,
): Promise<Task> {
  await delay(100)
  const idx = tasks.findIndex((t) => t.guid === guid)
  if (idx === -1) throw new Error('task not found')
  tasks[idx] = { ...tasks[idx], ...patch, updated_at: Date.now().toString() }
  return cloneTask(tasks[idx])
}

export async function deleteTask(guid: string): Promise<void> {
  await delay(100)
  const task = tasks.find((item) => item.guid === guid)
  if (!task) {
    throw new Error('task not found')
  }

  tasks = tasks.filter((item) => item.guid !== guid)

  if (task.parent_task_guid) {
    const parentIndex = tasks.findIndex((item) => item.guid === task.parent_task_guid)
    if (parentIndex !== -1) {
      tasks[parentIndex] = {
        ...tasks[parentIndex],
        subtask_count: Math.max(0, tasks[parentIndex].subtask_count - 1),
        updated_at: Date.now().toString(),
      }
    }
  }
}

export async function toggleTaskStatus(guid: string): Promise<Task> {
  const task = tasks.find((t) => t.guid === guid)
  if (!task) throw new Error('task not found')
  const now = Date.now().toString()
  return updateTask(guid, {
    status: task.status === 'done' ? 'todo' : 'done',
    completed_at: task.status === 'done' ? '0' : now,
  })
}

export async function createSection(
  tasklistGuid: string,
  name: string,
): Promise<Section> {
  await delay(100)
  const tl = tasklists.find((t) => t.guid === tasklistGuid)
  if (!tl) throw new Error('tasklist not found')
  const section: Section = {
    guid: generateGuid('sec'),
    name,
  }
  tl.sections.push(section)
  return { ...section }
}

export async function fetchSubtasks(parentTaskGuid: string): Promise<Task[]> {
  await delay(50)
  return tasks
    .filter((task) => task.parent_task_guid === parentTaskGuid)
    .map(cloneTask)
}
