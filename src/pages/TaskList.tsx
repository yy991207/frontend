import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from 'antd/es/layout'
import Button from 'antd/es/button'
import Tooltip from 'antd/es/tooltip'
import message from 'antd/es/message'
import { UnorderedListOutlined } from '@ant-design/icons'
import type { Task, Tasklist } from '@/types/task'
import type { Project } from '@/types/project'
import { getConfig } from '@/config/appConfig'
import { listProjects } from '@/services/projectService'
import { listSections } from '@/services/sectionService'
import {
  listTasks,
  getTask,
  apiTaskToTask,
} from '@/services/taskService'
import Sidebar, { type NavKey } from '@/components/Sidebar'
import TaskTable from '@/components/TaskTable'
import ActivityView from '@/components/ActivityView'
import PlaceholderView from '@/components/PlaceholderView'
import TaskDetailPanel from '@/components/TaskDetailPanel'
import TeamsManagerView from '@/components/TeamsManagerView'
import { getViewConfig } from '@/config/viewConfig'
import type { Section } from '@/types/task'
import './TaskList.less'

const { Sider, Content } = Layout

function projectToTasklist(p: Project): Tasklist {
  return {
    guid: p.project_id,
    name: p.name,
    owner: { id: p.creator_id, type: 'user' },
    creator: { id: p.creator_id, type: 'user' },
    members: [],
    sections: [],
    custom_fields: [],
    archive_msec: p.status === 'archived' ? '1' : '0',
    created_at: new Date(p.created_at).getTime().toString(),
    updated_at: new Date(p.updated_at).getTime().toString(),
    url: '',
  }
}

export default function TaskListPage() {
  const [activeNav, setActiveNav] = useState<NavKey>('my-assigned')
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasklists, setTasklists] = useState<Tasklist[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [reloadVersion, setReloadVersion] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('all')
  const [sortMode, setSortMode] = useState<'custom' | 'due' | 'start' | 'created'>('due')
  const [mineOnly, setMineOnly] = useState(false)
  const [pendingExpandTaskGuid, setPendingExpandTaskGuid] = useState<string | null>(null)
  const latestRequestIdRef = useRef(0)
  const sidebarResizeStateRef = useRef<{ dragging: boolean; startX: number; startWidth: number }>({
    dragging: false,
    startX: 0,
    startWidth: 240,
  })

  const currentUserId = getConfig().user_id

  const refreshData = useCallback(() => {
    setReloadVersion((prev) => prev + 1)
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!sidebarResizeStateRef.current.dragging) {
        return
      }

      // 左侧拖拽手柄在右边缘，向右拖时宽度应该随之增大。
      const delta = event.clientX - sidebarResizeStateRef.current.startX
      const nextWidth = sidebarResizeStateRef.current.startWidth + delta
      const boundedWidth = Math.min(360, Math.max(180, nextWidth))
      setSidebarWidth(boundedWidth)
    }

    const handlePointerUp = () => {
      sidebarResizeStateRef.current.dragging = false
      document.body.classList.remove('sidebar-resizing')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.classList.remove('sidebar-resizing')
    }
  }, [])

  useEffect(() => {
    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    const loadData = async () => {
      setLoading(true)

      let projects: Awaited<ReturnType<typeof listProjects>> = []
      try {
        projects = await listProjects()
      } catch (err) {
        if (requestId !== latestRequestIdRef.current) {
          return
        }
        message.error(err instanceof Error ? err.message : '加载清单失败')
        setTasklists([])
        setTasks([])
        setLoading(false)
        return
      }
      let tls = projects.map(projectToTasklist)

      // Load sections for the active tasklist so drag-and-drop has real section_id
      if (typeof activeNav === 'object' && activeNav.type === 'tasklist') {
        try {
          const apiSections = await listSections(activeNav.guid)
          const sections: Section[] = apiSections
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s) => ({
              guid: s.section_id,
              name: s.name,
              sort_order: s.sort_order,
              is_default: s.is_default,
            }))
          tls = tls.map((tl) =>
            tl.guid === activeNav.guid ? { ...tl, sections } : tl,
          )
        } catch {
          // ignore; tasklist will just have empty sections
        }
      }

      let nextTasks: Task[] = []
      const commonParams: Parameters<typeof listTasks>[0] = {
        page_size: 100,
      }
      if (statusFilter !== 'all') {
        commonParams.status = statusFilter === 'done' ? 'done' : 'todo'
      }
      const effectiveSortMode = sortMode === 'custom' ? 'due' : sortMode
      const sortMap: Record<string, string> = {
        due: 'due_date',
        start: 'start_date',
        created: 'created_at',
      }
      commonParams.sort_by = sortMap[effectiveSortMode] ?? 'due_date'
      commonParams.order = 'desc'
      if (typeof activeNav === 'string') {
        const params: Parameters<typeof listTasks>[0] = { ...commonParams }
        switch (activeNav) {
          case 'my-assigned':
            params.assignee_id = currentUserId
            break
          case 'my-followed':
            params.involved_user_id = currentUserId
            break
          case 'my-created':
            params.creator_id = currentUserId
            break
          case 'my-assigned-quick':
            params.creator_id = currentUserId
            break
          case 'done':
            params.status = 'done'
            break
          case 'activity':
            params.creator_id = currentUserId
            break
        }
        try {
          const { items } = await listTasks(params)
          let filtered = items
          if (activeNav === 'my-assigned-quick') {
            filtered = items.filter((t) => {
              // “我分配的”只展示我创建且已经分配负责人的任务；这里要同时兼容新旧负责人字段。
              const assignedUserIds = [
                ...(t.assignee_ids ?? []),
                ...(t.assignee_id ? [t.assignee_id] : []),
              ].filter(Boolean)
              return assignedUserIds.length > 0
            })
          }
          nextTasks = filtered.map((t) => apiTaskToTask(t))
        } catch {
          nextTasks = []
        }
      } else if (activeNav.type === 'tasklist') {
        try {
          const params: Parameters<typeof listTasks>[0] = {
            ...commonParams,
            project_id: activeNav.guid,
          }
          if (mineOnly) params.assignee_id = currentUserId
          const { items } = await listTasks(params)
          nextTasks = items.map((t) => apiTaskToTask(t, activeNav.guid))
        } catch {
          nextTasks = []
        }
      }

      if (requestId !== latestRequestIdRef.current) {
        return
      }

      setTasklists(tls)
      setTasks(nextTasks)
      setLoading(false)
    }

    void loadData()
  }, [activeNav, currentUserId, reloadVersion, statusFilter, sortMode, mineOnly])

  const activeTasklist =
    typeof activeNav === 'object' && activeNav.type === 'tasklist'
      ? tasklists.find((t) => t.guid === activeNav.guid)
      : undefined

  const updateTaskInState = useCallback((nextTask: Task) => {
    setTasks((prev) => {
      const exists = prev.some((task) => task.guid === nextTask.guid)
      if (!exists) {
        return prev
      }
      return prev.map((task) => (task.guid === nextTask.guid ? nextTask : task))
    })
    setSelectedTask((prev) => (prev?.guid === nextTask.guid ? nextTask : prev))
  }, [])

  const removeTaskFromState = useCallback((taskGuid: string) => {
    setTasks((prev) => {
      const deletedTask = prev.find((task) => task.guid === taskGuid)
      const removedTaskGuidSet = new Set([taskGuid])
      let changed = true
      while (changed) {
        changed = false
        for (const task of prev) {
          if (task.parent_task_guid && removedTaskGuidSet.has(task.parent_task_guid)) {
            if (!removedTaskGuidSet.has(task.guid)) {
              removedTaskGuidSet.add(task.guid)
              changed = true
            }
          }
        }
      }
      return prev
        .filter((task) => !removedTaskGuidSet.has(task.guid))
        .map((task) => {
          if (task.guid !== deletedTask?.parent_task_guid) {
            return task
          }

          // 子任务删除后先本地修正父任务计数，避免父行继续显示旧的 0/1 进度。
          return {
            ...task,
            subtask_count: Math.max(0, task.subtask_count - 1),
          }
        })
    })
    setSelectedTask((prev) => (prev?.guid === taskGuid ? null : prev))
  }, [])

  const addTasklistToState = useCallback((tasklist: Tasklist) => {
    setTasklists((prev) => {
      if (prev.some((item) => item.guid === tasklist.guid)) {
        return prev.map((item) => (item.guid === tasklist.guid ? tasklist : item))
      }
      return [...prev, tasklist]
    })
    setActiveNav({ type: 'tasklist', guid: tasklist.guid })
    setSelectedTask(null)
    setTasks([])
  }, [])

  const updateTasklistInState = useCallback((nextTasklist: Tasklist) => {
    setTasklists((prev) =>
      prev.map((item) => (item.guid === nextTasklist.guid ? nextTasklist : item)),
    )
  }, [])

  const handleTaskCreated = useCallback(
    (createdTask: Task, targetSection?: Section) => {
      // 静态页阶段优先做本地状态增量更新，避免新建任务后整页重新拉数导致的闪动和折叠状态丢失。
      setTasks((prev) => [createdTask, ...prev])

      if (
        targetSection &&
        activeTasklist &&
        targetSection.defaultCollapsed
      ) {
        setTasklists((prev) =>
          prev.map((tasklist) =>
            tasklist.guid === activeTasklist.guid
              ? {
                  ...tasklist,
                  sections: tasklist.sections.map((section) =>
                    section.guid === targetSection.guid
                      ? { ...section, defaultCollapsed: false }
                      : section,
                  ),
                }
              : tasklist,
          ),
        )
      }
    },
    [activeTasklist],
  )

  const handleOpenTaskDetail = useCallback((task: Task) => {
    setSelectedTask(task)
  }, [])

  const handleSubtaskCreated = useCallback(
    (createdTask: Task) => {
      setTasks((prev) => [createdTask, ...prev])
      if (createdTask.parent_task_guid) {
        setPendingExpandTaskGuid(createdTask.parent_task_guid)
        getTask(createdTask.parent_task_guid)
          .then((apiTask) => updateTaskInState(apiTaskToTask(apiTask)))
          .catch(() => {})
      }
    },
    [updateTaskInState],
  )

  const handleNavigate = (key: NavKey) => {
    setActiveNav(key)
    setSelectedTask(null)
  }

  const toggleSidebar = () => setSidebarCollapsed((v) => !v)

  const handleSidebarResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    sidebarResizeStateRef.current = {
      dragging: true,
      startX: event.clientX,
      startWidth: sidebarWidth,
    }
    document.body.classList.add('sidebar-resizing')
  }

  const renderMainView = () => {
    // 动态视图
    if (activeNav === 'activity') {
      return (
        <ActivityView
          onTaskClick={(task) => setSelectedTask(task)}
          onTaskOpen={(task) => setSelectedTask(task)}
          onRefresh={refreshData}
        />
      )
    }

    if (activeNav === 'settings') {
      return <TeamsManagerView />
    }

    // 其他视图都用 TaskTable，基于 viewConfig 差异化渲染
    const config = getViewConfig(activeNav, activeTasklist?.name)
    if (!config) {
      return <PlaceholderView title="未知视图" />
    }

    return (
      <TaskTable
        key={typeof activeNav === 'string' ? activeNav : `tasklist:${activeNav.guid}`}
        config={config}
        tasks={tasks}
        sections={activeTasklist?.sections}
        tasklist={activeTasklist}
        selectedTaskGuid={selectedTask?.guid}
        loading={loading}
        statusFilter={statusFilter}
        sortMode={sortMode}
        mineOnly={mineOnly}
        onStatusFilterChange={setStatusFilter}
        onSortModeChange={setSortMode}
        onMineOnlyChange={setMineOnly}
        onTaskClick={(task) => setSelectedTask(task)}
        onRefresh={refreshData}
        onTaskCreated={handleTaskCreated}
        onTaskUpdated={updateTaskInState}
        onTasklistUpdated={updateTasklistInState}
        onTaskCreatedDetailOpen={handleOpenTaskDetail}
        onTaskDeleted={removeTaskFromState}
        pendingExpandTaskGuid={pendingExpandTaskGuid}
        onPendingExpandConsumed={(taskGuid) => {
          setPendingExpandTaskGuid((prev) => (prev === taskGuid ? null : prev))
        }}
      />
    )
  }

  return (
    <Layout className="app-layout">
      {!sidebarCollapsed && (
        <Sider
          width={sidebarWidth}
          collapsedWidth={0}
          collapsible
          collapsed={false}
          trigger={null}
          theme="light"
          className="app-sider"
        >
          <div
            className="sidebar-resize-handle"
            onPointerDown={handleSidebarResizeStart}
          />
          <Sidebar
            activeKey={activeNav}
            tasklists={tasklists}
            onNavigate={handleNavigate}
            onTasklistsChange={refreshData}
            onTasklistCreated={addTasklistToState}
            onTasklistUpdated={updateTasklistInState}
            onToggleCollapse={toggleSidebar}
          />
        </Sider>
      )}

      <Layout className="app-main-layout">
        <Content className="app-content">
          {sidebarCollapsed && (
            <Tooltip title="展开侧边栏" placement="right">
              <Button
                type="text"
                size="small"
                icon={<UnorderedListOutlined />}
                onClick={toggleSidebar}
                className="sidebar-expand-btn"
              />
            </Tooltip>
          )}
          {renderMainView()}
        </Content>
      </Layout>

      {selectedTask && (
        <TaskDetailPanel
          key={selectedTask.guid}
          task={selectedTask}
          tasklists={tasklists}
          onRefresh={refreshData}
          onTaskUpdated={updateTaskInState}
          onSubtaskCreated={handleSubtaskCreated}
          onTaskDeleted={removeTaskFromState}
          onOpenTask={(t) => setSelectedTask(t)}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </Layout>
  )
}
