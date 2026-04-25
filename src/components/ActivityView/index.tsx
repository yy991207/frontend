import { useEffect, useMemo, useState } from 'react'
import Typography from 'antd/es/typography'
import Empty from 'antd/es/empty'
import Avatar from 'antd/es/avatar'
import Spin from 'antd/es/spin'
import message from 'antd/es/message'
import dayjs from 'dayjs'
import type { Task, User } from '@/types/task'
import { listMembers } from '@/services/teamService'
import { normalizeRichContent } from '@/components/TaskRichInput'
import {
  apiTaskToTask,
  getTask,
  listMyActivities,
  type ApiTaskActivity,
} from '@/services/taskService'
import type { ReactNode } from 'react'
import './index.less'

const { Title, Text } = Typography

interface ActivityViewProps {
  onTaskClick: (task: Task) => void
  onTaskOpen: (task: Task) => void
  onRefresh: () => void
}

type ActivityGroup = {
  label: string
  day: string
  timeGroups: ActivityTimeGroup[]
}

type ActivityTimeGroup = {
  time: string
  items: ApiTaskActivity[]
}

function formatActivityDateLabel(date: dayjs.Dayjs): string {
  const now = dayjs()
  if (date.isSame(now, 'day')) {
    return '今天'
  }
  if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return '昨天'
  }
  return date.format('M月D日')
}

function groupActivitiesByTime(activities: ApiTaskActivity[]): ActivityTimeGroup[] {
  const grouped = new Map<string, ApiTaskActivity[]>()
  for (const activity of activities) {
    const time = dayjs(activity.created_at).format('HH:mm')
    const current = grouped.get(time) ?? []
    current.push(activity)
    grouped.set(time, current)
  }

  return Array.from(grouped.entries()).map(([time, items]) => ({
    time,
    items,
  }))
}

function groupActivitiesByDate(activities: ApiTaskActivity[]): ActivityGroup[] {
  const grouped = new Map<string, ApiTaskActivity[]>()
  for (const activity of activities) {
    const date = dayjs(activity.created_at)
    const key = date.format('YYYY-MM-DD')
    const current = grouped.get(key) ?? []
    current.push(activity)
    grouped.set(key, current)
  }

  return Array.from(grouped.entries()).map(([key, items]) => {
    const date = dayjs(key)
    return {
      label: formatActivityDateLabel(date),
      day: date.format('D'),
      timeGroups: groupActivitiesByTime(items),
    }
  })
}

function normalizeActivityValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '空'
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeActivityValue(item)).join('、') || '空'
  }
  if (typeof value === 'string') {
    const normalizedHtml = normalizeRichContent(value)
    if (!normalizedHtml) {
      return '空'
    }
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(normalizedHtml, 'text/html')
      const text = (doc.body.textContent ?? '').replaceAll(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
      return text || '空'
    }
    return normalizedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '空'
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function getActivityDisplayValue(
  payload: Record<string, unknown>,
  prefer: 'new' | 'old' = 'new',
): string {
  const labeledValue =
    prefer === 'old' ? payload.old_value_label : payload.new_value_label
  const rawValue = prefer === 'old' ? payload.old_value : payload.new_value

  if (typeof labeledValue === 'string' && labeledValue.trim().length > 0) {
    return normalizeActivityValue(labeledValue)
  }

  return normalizeActivityValue(rawValue)
}

function buildActivityMessage(activity: ApiTaskActivity, actorLabel: string): ReactNode {
  const payload = activity.payload as Record<string, unknown>
  const taskTitle =
    typeof payload.task_title === 'string' && payload.task_title.trim().length > 0
      ? payload.task_title.trim()
      : '该任务'
  const actor = actorLabel || '有人'

  switch (activity.event_type) {
    case 'task.created':
      return (
        <>
          <span className="activity-person">{actor}</span>
          <span> 创建了任务 </span>
          <span className="activity-task-title">{taskTitle}</span>
        </>
      )
    case 'task.completed':
      return (
        <>
          <span className="activity-person">{actor}</span>
          <span> 完成了任务 </span>
          <span className="activity-task-title">{taskTitle}</span>
        </>
      )
    case 'task.status_changed':
      return (
        <>
          <span className="activity-person">{actor}</span>
          <span> 将任务状态更新为 </span>
          <span className="activity-task-title">{getActivityDisplayValue(payload)}</span>
        </>
      )
    case 'task.priority_changed':
      return (
        <>
          <span className="activity-person">{actor}</span>
          <span> 将任务优先级更新为 </span>
          <span className="activity-task-title">{getActivityDisplayValue(payload)}</span>
        </>
      )
    case 'task.description_changed':
      return (
        <>
          <span className="activity-person">{actor}</span>
          <span> 修改了 </span>
          <span className="activity-task-title">{taskTitle}</span>
          <span> 的描述</span>
        </>
      )
    case 'task.assignee_changed':
      return (
        <>
          <span className="activity-person">{actor}</span>
          <span> 更新了 </span>
          <span className="activity-task-title">{taskTitle}</span>
          <span> 的负责人</span>
        </>
      )
    case 'comment.created':
      return (
        <>
          <span className="activity-person">{actor}</span>
          <span> 在 </span>
          <span className="activity-task-title">{taskTitle}</span>
          <span> 发了评论</span>
        </>
      )
    default:
      return (
        <>
          <span className="activity-person">{actor}</span>
          <span> 更新了 </span>
          <span className="activity-task-title">{taskTitle}</span>
        </>
      )
  }
}

function formatActivityDetail(activity: ApiTaskActivity, actorLabel: string): ReactNode | null {
  const payload = activity.payload as Record<string, unknown>
  const fieldLabel =
    typeof payload.field_name === 'string' && payload.field_name.trim().length > 0
      ? payload.field_name.trim()
      : '字段'
  const value =
    typeof payload.new_value_label === 'string' || typeof payload.old_value_label === 'string'
      ? getActivityDisplayValue(payload)
      : typeof payload.comment_excerpt === 'string'
        ? normalizeActivityValue(payload.comment_excerpt)
        : typeof payload.file_name === 'string'
          ? normalizeActivityValue(payload.file_name)
          : normalizeActivityValue(payload.new_value)

  switch (activity.event_type) {
    case 'task.description_changed':
      return (
        <span className="activity-message-line">
          <span className="activity-person">{actorLabel}</span>
          <span> 将“{fieldLabel}”修改为：</span>
          <span className="activity-value">{value}</span>
        </span>
      )
    case 'task.custom_field_changed':
      return (
        <span className="activity-message-line">
          <span className="activity-person">{actorLabel}</span>
          <span> 将“{fieldLabel}”修改为：</span>
          <span className="activity-value">{value}</span>
        </span>
      )
    case 'task.status_changed':
      return null
    case 'task.priority_changed':
      return null
    case 'task.created':
    case 'task.completed':
    case 'task.assignee_changed':
      return null
    case 'comment.created':
      return (
        <span className="activity-message-line">
          <span className="activity-person">{actorLabel}</span>
          <span> 发表了评论：</span>
          <span className="activity-value">{value}</span>
        </span>
      )
    case 'attachment.uploaded':
    case 'attachment.created':
      return (
        <span className="activity-message-line">
          <span className="activity-person">{actorLabel}</span>
          <span> 上传了附件：</span>
          <span className="activity-value">{value}</span>
        </span>
      )
    case 'attachment.deleted':
      return (
        <span className="activity-message-line">
          <span className="activity-person">{actorLabel}</span>
          <span> 移除了附件：</span>
          <span className="activity-value">{value}</span>
        </span>
      )
    default:
      if (typeof payload.field === 'string' && payload.field.trim().length > 0) {
        return (
          <span className="activity-message-line">
            <span className="activity-person">{actorLabel}</span>
            <span> 将“{payload.field.trim()}”修改为：</span>
            <span className="activity-value">{value}</span>
          </span>
        )
      }
      return null
  }
}

export default function ActivityView({
  onTaskClick,
  onTaskOpen,
  onRefresh,
}: ActivityViewProps) {
  const [activities, setActivities] = useState<ApiTaskActivity[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([listMyActivities(1, 100), listMembers().catch(() => [])])
      .then(([activityList, members]) => {
        if (cancelled) return
        setActivities(activityList)
        setUsers(
          members.map((member) => ({
            id: member.user_id,
            name: member.user_name ?? member.user_id,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) {
          message.error('加载动态失败')
          setActivities([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [onRefresh])

  const groupedActivities = useMemo(() => groupActivitiesByDate(activities), [activities])

  const resolveUserLabel = (userId: string): string => {
    const user = users.find((item) => item.id === userId)
    return user?.name ?? userId
  }

  const handleTaskClick = async (activity: ApiTaskActivity) => {
    const taskId = activity.task_id
    if (!taskId) {
      return
    }
    try {
      const apiTask = await getTask(taskId)
      const task = apiTaskToTask(apiTask)
      onTaskClick(task)
      onTaskOpen(task)
    } catch {
      message.error('加载任务详情失败')
    }
  }

  return (
    <div className="activity-view">
      <div className="activity-header">
        <Title level={5} className="activity-title">
          动态
        </Title>
      </div>

      {loading ? (
        <div className="activity-empty">
          <Spin size="small" />
        </div>
      ) : activities.length === 0 ? (
        <div className="activity-empty">
          <Empty description="暂无动态" />
        </div>
      ) : (
        <div className="activity-list">
          {groupedActivities.map((group) => (
            <div key={`${group.label}-${group.day}`} className="activity-group">
              <div className="activity-date">
                <Text type="secondary" className="activity-date-label">
                  {group.label}
                </Text>
                <div className="activity-date-day">{group.day}</div>
              </div>

              <div className="activity-items">
                {group.timeGroups.map((timeGroup) => (
                  <div
                    key={`${group.label}-${group.day}-${timeGroup.time}`}
                    className="activity-time-group"
                  >
                    <div className="activity-time">{timeGroup.time}</div>
                    <div className="activity-time-group-items">
                      {timeGroup.items.map((activity) => {
                        const actorLabel = resolveUserLabel(activity.actor_id)
                        const detail = formatActivityDetail(activity, actorLabel)
                        return (
                          <div
                            key={activity.activity_id}
                            className="activity-item"
                            onClick={() => void handleTaskClick(activity)}
                          >
                            <Avatar size={24} className="activity-avatar">
                              {actorLabel.slice(0, 1).toUpperCase()}
                            </Avatar>
                            <div className="activity-content">
                              <div className="activity-message" title={normalizeActivityValue(activity.payload)}>
                                {buildActivityMessage(activity, actorLabel)}
                              </div>
                              {detail && <div className="activity-detail">{detail}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
