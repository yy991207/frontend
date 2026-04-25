import { useEffect, useMemo, useState } from 'react'
import Modal from 'antd/es/modal'
import Select from 'antd/es/select'
import Typography from 'antd/es/typography'
import type { Task } from '@/types/task'

interface TaskParentPickerModalProps {
  open: boolean
  task: Task | null
  tasks: Task[]
  submitting?: boolean
  onClose: () => void
  onSubmit: (parentTaskId: string) => Promise<void> | void
}

function collectDescendantTaskGuids(rootTaskGuid: string, tasks: Task[]): Set<string> {
  const childrenByParent = new Map<string, string[]>()

  for (const task of tasks) {
    if (!task.parent_task_guid) {
      continue
    }

    const children = childrenByParent.get(task.parent_task_guid) ?? []
    children.push(task.guid)
    childrenByParent.set(task.parent_task_guid, children)
  }

  const descendants = new Set<string>()
  const pending = [...(childrenByParent.get(rootTaskGuid) ?? [])]

  // 设置父任务时要避开自己和自己的所有后代，防止前端把环形父子关系送给后端。
  while (pending.length > 0) {
    const taskGuid = pending.pop()
    if (!taskGuid || descendants.has(taskGuid)) {
      continue
    }

    descendants.add(taskGuid)
    pending.push(...(childrenByParent.get(taskGuid) ?? []))
  }

  return descendants
}

export default function TaskParentPickerModal({
  open,
  task,
  tasks,
  submitting = false,
  onClose,
  onSubmit,
}: TaskParentPickerModalProps) {
  const [selectedParentTaskId, setSelectedParentTaskId] = useState<string>()

  const parentTaskOptions = useMemo(() => {
    if (!task) {
      return []
    }

    const currentTasklistGuid = task.tasklists[0]?.tasklist_guid
    if (!currentTasklistGuid) {
      return []
    }

    const blockedTaskGuids = collectDescendantTaskGuids(task.guid, tasks)
    blockedTaskGuids.add(task.guid)

    return tasks
      .filter((item) => {
        if (blockedTaskGuids.has(item.guid)) {
          return false
        }

        return item.tasklists.some((ref) => ref.tasklist_guid === currentTasklistGuid)
      })
      .map((item) => {
        const depthPrefix = item.depth && item.depth > 0 ? `[子${item.depth}] ` : ''
        return {
          label: `${depthPrefix}${item.summary}`,
          value: item.guid,
        }
      })
  }, [task, tasks])

  useEffect(() => {
    if (!open || !task) {
      return
    }

    const currentParentTaskId = task.parent_task_guid || undefined
    const hasCurrentParentOption = parentTaskOptions.some((item) => item.value === currentParentTaskId)
    setSelectedParentTaskId(hasCurrentParentOption ? currentParentTaskId : undefined)
  }, [open, parentTaskOptions, task])

  const handleSubmit = () => {
    if (!selectedParentTaskId) {
      return
    }
    void onSubmit(selectedParentTaskId)
  }

  return (
    <Modal
      open={open}
      title="设置父任务"
      okText="确定"
      cancelText="取消"
      destroyOnHidden
      confirmLoading={submitting}
      okButtonProps={{ disabled: !selectedParentTaskId || parentTaskOptions.length === 0 }}
      onCancel={onClose}
      onOk={handleSubmit}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Typography.Text type="secondary">
          选择后，当前任务会移动到目标父任务下面。自己和自己的子任务不会出现在候选列表里。
        </Typography.Text>
        <Select
          showSearch
          placeholder="搜索并选择父任务"
          value={selectedParentTaskId}
          options={parentTaskOptions}
          optionFilterProp="label"
          notFoundContent="没有可选父任务"
          onChange={(value) => setSelectedParentTaskId(value)}
        />
      </div>
    </Modal>
  )
}
