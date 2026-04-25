import type { Task } from '@/types/task'

export function inheritParentStartForTasks(tasks: Task[], parent: Task): Task[] {
  return tasks.map((task) => {
    if (!task.parent_task_guid) {
      return task
    }

    // 子任务开始时间跟随父任务，前端展示和本地缓存都以父任务为准。
    return {
      ...task,
      start: parent.start ? { ...parent.start } : undefined,
    }
  })
}
