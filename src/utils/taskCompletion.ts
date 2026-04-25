import { getConfig } from '@/config/appConfig'
import type { TeamMember } from '@/services/teamService'
import type { Task } from '@/types/task'

export interface TaskCompletionAction {
  key: string
  label: string
  status: 'done' | 'todo'
  scope?: 'self' | 'all'
}

export interface TaskCompletionSummary {
  doneCount: number
  totalCount: number
}

export function getTaskCompletionSummary(task: Task): TaskCompletionSummary {
  const completions = task.assignee_completions ?? []
  if (completions.length > 0) {
    return {
      doneCount: completions.filter((item) => item.is_completed).length,
      totalCount: completions.length,
    }
  }

  const assigneeCount = task.members.filter((member) => member.role === 'assignee').length
  if (assigneeCount <= 0) {
    return { doneCount: task.status === 'done' ? 1 : 0, totalCount: 0 }
  }

  return { doneCount: task.status === 'done' ? assigneeCount : 0, totalCount: assigneeCount }
}

export function isCurrentUserTaskAssignee(task: Task): boolean {
  return task.members.some((member) => member.role === 'assignee' && member.id === getConfig().user_id)
}

export function isCurrentUserAssigneeCompleted(task: Task): boolean {
  const currentCompletion = task.assignee_completions?.find(
    (item) => item.user_id === getConfig().user_id,
  )
  if (currentCompletion) {
    return currentCompletion.is_completed
  }
  return isCurrentUserTaskAssignee(task) ? task.status === 'done' : false
}

export function isCurrentUserTaskAdmin(teamMembers: TeamMember[]): boolean {
  const currentMember = teamMembers.find((member) => member.user_id === getConfig().user_id)
  return currentMember?.role === 'owner' || currentMember?.role === 'admin'
}

export function canConfigureTaskCompletionMode(task: Task): boolean {
  const assigneeCount = task.members.filter((member) => member.role === 'assignee').length
  return assigneeCount > 1
}

export function getTaskCompletionActions(
  task: Task,
  teamMembers: TeamMember[],
): TaskCompletionAction[] {
  const assigneeCount = task.members.filter((member) => member.role === 'assignee').length
  const isDone = task.status === 'done'
  const isSelfCompleted = isCurrentUserAssigneeCompleted(task)
  const isAssignee = isCurrentUserTaskAssignee(task)
  const isAdmin = isCurrentUserTaskAdmin(teamMembers)
  const isAdminAndAssignee = isAdmin && isAssignee

  if (assigneeCount > 1 && isAdminAndAssignee) {
    if (!isSelfCompleted) {
      return [
        { key: 'done:self', label: '仅我完成', status: 'done', scope: 'self' },
        { key: 'done:all', label: '为所有负责人完成', status: 'done', scope: 'all' },
      ]
    }
    return [
      { key: 'todo:self', label: '重启任务', status: 'todo', scope: 'self' },
      { key: 'todo:all', label: '为所有负责人完成', status: 'done', scope: 'all' },
    ]
  }

  if (!isDone) {
    return [{ key: 'done', label: '标记完成', status: 'done' }]
  }

  return [{ key: 'todo', label: '重启任务', status: 'todo' }]
}
