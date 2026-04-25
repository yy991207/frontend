import { useState, useMemo, useEffect, useRef } from 'react'
import message from 'antd/es/message'
import Dropdown from 'antd/es/dropdown'
import Tree from 'antd/es/tree'
import Menu from 'antd/es/menu'
import Button from 'antd/es/button'
import Modal from 'antd/es/modal'
import Typography from 'antd/es/typography'
import Divider from 'antd/es/divider'
import Tooltip from 'antd/es/tooltip'
import Flex from 'antd/es/flex'
import Space from 'antd/es/space'
import Select from 'antd/es/select'
import Spin from 'antd/es/spin'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { MenuProps } from 'antd/es/menu'
import {
  UserOutlined,
  EyeOutlined,
  HistoryOutlined,
  StarOutlined,
  FileTextOutlined,
  FileDoneOutlined,
  OrderedListOutlined,
  AppstoreOutlined,
  PlusOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  UnorderedListOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  EllipsisOutlined,
  DeleteOutlined,
  EditOutlined,
  ShareAltOutlined,
  InboxOutlined,
  StopOutlined,
  DragOutlined,
} from '@ant-design/icons'
import type { Tasklist } from '@/types/task'
import NotificationBell from '@/components/NotificationBell'
import CustomFieldsModal from '@/components/CustomFieldsModal'
import type { ProjectGroup } from '@/types/projectGroup'
import type { Project } from '@/types/project'
import {
  listProjectGroups,
  createProjectGroup,
  updateProjectGroup as apiUpdateProjectGroup,
  deleteProjectGroup as apiDeleteProjectGroup,
  updateGroupSortOrder,
} from '@/services/projectGroupService'
import {
  listProjects,
  createProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  archiveProject as apiArchiveProject,
  moveProjectToGroup,
  distributeProject,
} from '@/services/projectService'
import {
  listMembers,
  listTeams,
  type Team,
} from '@/services/teamService'
import { getConfig } from '@/config/appConfig'
import EditableInput from '@/components/EditableInput'
import './index.less'

const { Title, Text } = Typography

export type NavKey =
  | 'my-assigned'
  | 'my-followed'
  | 'activity'
  | 'from-project'
  | 'all-tasks'
  | 'my-created'
  | 'my-assigned-quick'
  | 'done'
  | 'settings'
  | { type: 'tasklist'; guid: string }

interface SidebarProps {
  activeKey: NavKey
  tasklists: Tasklist[]
  onNavigate: (key: NavKey) => void
  onTasklistsChange?: () => void
  onTasklistCreated?: (tasklist: Tasklist) => void
  onTasklistUpdated?: (tasklist: Tasklist) => void
  onToggleCollapse?: () => void
}

type CreatingTarget = 'root' | string

const encodeTasklistKey = (guid: string) => `tl:${guid}`
const encodeGroupKey = (id: string) => `grp:${id}`
const EMPTY_GROUP_PLACEHOLDER_PREFIX = 'grp-empty:'

const buildEmptyGroupPlaceholderNode = (groupId: string): DataNode => ({
  key: `${EMPTY_GROUP_PLACEHOLDER_PREFIX}${groupId}`,
  title: <div className="empty-group-drop-hint">可拖拽清单加入该分组</div>,
  selectable: false,
  isLeaf: true,
  className: 'empty-group-placeholder',
})

function buildSidebarDragNodeClassName(
  nodeKey: string,
  draggingTasklistKey: string | null,
  dropIndicatorState: {
    key: string
    dropPosition: -1 | 0 | 1 | null
  } | null,
  baseClassName?: string,
): string {
  const classNames = [baseClassName]
  if (draggingTasklistKey === nodeKey) {
    classNames.push('dragging')
  }
  if (dropIndicatorState?.key === nodeKey) {
    classNames.push('drop-target')
    if (dropIndicatorState.dropPosition === -1) {
      classNames.push('drop-target-gap-top')
    } else if (dropIndicatorState.dropPosition === 1) {
      classNames.push('drop-target-gap-bottom')
    } else {
      classNames.push('drop-target-inner')
    }
  }
  return classNames.filter(Boolean).join(' ')
}

// 刷新后默认展示完整清单树：根清单区和所有清单分组都展开。
const buildDefaultExpandedKeys = (groups: ProjectGroup[]): React.Key[] => [
  'root',
  ...groups
    .filter((group) => !group.is_default)
    .map((group) => encodeGroupKey(group.group_id)),
]

function generateDefaultTasklistName(projects: Project[]): string {
  const maxIndex = projects.reduce((max, proj) => {
    const match = proj.name.match(/^任务清单\s*(\d+)$/)
    if (!match) {
      return max
    }
    return Math.max(max, Number(match[1]))
  }, 0)

  return `任务清单 ${maxIndex + 1}`
}

export default function Sidebar({
  activeKey,
  tasklists,
  onNavigate,
  onTasklistsChange,
  onTasklistCreated,
  onTasklistUpdated,
  onToggleCollapse,
}: SidebarProps) {
  const [creatingTarget, setCreatingTarget] = useState<CreatingTarget | null>(null)
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [draftGroupUid, setDraftGroupUid] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingTasklistGuid, setEditingTasklistGuid] = useState<string | null>(null)
  const [openedGroupMenuId, setOpenedGroupMenuId] = useState<string | null>(null)
  const [openedProjectMenuId, setOpenedProjectMenuId] = useState<string | null>(null)
  const [customFieldsProjectId, setCustomFieldsProjectId] = useState<string | null>(null)
  const [shareModalProject, setShareModalProject] = useState<Project | null>(null)
  const [shareTargetTeams, setShareTargetTeams] = useState<Team[]>([])
  const [selectedShareTeamIds, setSelectedShareTeamIds] = useState<string[]>([])
  const [shareTeamLoading, setShareTeamLoading] = useState(false)
  const [shareSubmitting, setShareSubmitting] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['root'])
  const [draggingTasklistKey, setDraggingTasklistKey] = useState<string | null>(null)
  const [dropIndicatorState, setDropIndicatorState] = useState<{
    key: string
    dropPosition: -1 | 0 | 1 | null
  } | null>(null)
  const shareRequestIdRef = useRef(0)

  useEffect(() => {
    listProjectGroups()
      .then((list) => {
        setGroups(list)
        setExpandedKeys((prev) => {
          const next = new Set(prev)
          buildDefaultExpandedKeys(list).forEach((key) => next.add(key))
          return Array.from(next)
        })
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '加载分组失败'
        message.error(msg)
      })

    listProjects()
      .then((list) => {
        setProjects(list)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '加载清单失败'
        message.error(msg)
      })
  }, [])

  // 顶部主菜单（Menu）
  const topMenuItems: MenuProps['items'] = [
    {
      key: 'my-assigned',
      icon: <UserOutlined />,
      label: '我负责的',
    },
    { key: 'my-followed', icon: <EyeOutlined />, label: '我关注的' },
    { key: 'activity', icon: <HistoryOutlined />, label: '动态' },
  ]

  // 快速访问 Menu
  const quickAccessItems: MenuProps['items'] = [
    {
      key: 'quick-access',
      type: 'group',
      label: '快速访问',
      children: [
        { key: 'all-tasks', icon: <FileTextOutlined />, label: '全部任务' },
        { key: 'my-created', icon: <OrderedListOutlined />, label: '我创建的' },
        { key: 'my-assigned-quick', icon: <AppstoreOutlined />, label: '我分配的' },
        { key: 'done', icon: <StarOutlined />, label: '已完成' },
      ],
    },
  ]

  const selectedMenuKey = typeof activeKey === 'string' ? activeKey : ''

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    onNavigate(key as NavKey)
  }

  const startCreateTasklist = async (target: CreatingTarget) => {
    if (creatingTarget) {
      return
    }
    setCreatingTarget(target)
    const expandKey = target === 'root' ? 'root' : encodeGroupKey(target)
    setExpandedKeys((prev) =>
      prev.includes(expandKey) ? prev : [...prev, expandKey],
    )

    try {
      const groupId = target !== 'root' ? target : undefined
      const defaultName = generateDefaultTasklistName(projects)
      const project = await createProject(defaultName, groupId)
      setProjects((prev) => [...prev, project])

      const tasklist: Tasklist = {
        guid: project.project_id,
        name: project.name,
        owner: { id: project.creator_id, type: 'user' },
        creator: { id: project.creator_id, type: 'user' },
        members: [],
        sections: [],
        custom_fields: [],
        archive_msec: '0',
        created_at: new Date(project.created_at).getTime().toString(),
        updated_at: new Date(project.updated_at).getTime().toString(),
        url: '',
      }

      setEditingTasklistGuid(project.project_id)
      onTasklistCreated?.(tasklist)
      if (!onTasklistCreated) {
        onTasklistsChange?.()
        onNavigate({ type: 'tasklist', guid: project.project_id })
      }
    } catch {
      message.error('创建清单失败')
    } finally {
      setCreatingTarget(null)
    }
  }

  const handleStartCreateGroup = async () => {
    if (draftGroupUid) return
    try {
      const created = await createProjectGroup('新分组')
      setGroups((prev) => [...prev, created])
      setExpandedKeys((prev) => [...prev, encodeGroupKey(created.group_id)])
      // 立即进入重命名模式，便于修改名称
      setEditingGroupId(created.group_id)
      message.success('已创建清单分组')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建清单分组失败'
      message.error(msg)
    }
  }

  const handleSaveGroupName = async (groupId: string, rawName: string) => {
    const name = rawName.trim()
    const isDraft = groupId === draftGroupUid

    if (!name || name.length > 50) {
      if (isDraft) {
        setDraftGroupUid(null)
      }
      setEditingGroupId(null)
      return
    }

    if (isDraft) {
      try {
        const created = await createProjectGroup(name)
        setGroups((prev) => [...prev, created])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '操作失败'
        message.error(msg)
      } finally {
        setDraftGroupUid(null)
        setEditingGroupId(null)
      }
    } else {
      try {
        const updated = await apiUpdateProjectGroup(groupId, name)
        setGroups((prev) =>
          prev.map((g) => (g.group_id === groupId ? updated : g)),
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '操作失败'
        message.error(msg)
      } finally {
        setEditingGroupId(null)
      }
    }
  }

  const handleStartRenameGroup = (groupId: string) => {
    setOpenedGroupMenuId(null)
    setEditingGroupId(groupId)
  }

  const handleDeleteGroup = async (groupId: string) => {
    setOpenedGroupMenuId(null)
    setEditingGroupId((prev) => (prev === groupId ? null : prev))
    try {
      await apiDeleteProjectGroup(groupId)
      setGroups((prev) => prev.filter((group) => group.group_id !== groupId))
      message.success('已删除清单分组')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败'
      message.error(msg)
    }
  }

  const handleRenameTasklist = async (tasklistGuid: string, rawName: string) => {
    const currentProject = projects.find((p) => p.project_id === tasklistGuid)
    const currentTasklist = tasklists.find((tasklist) => tasklist.guid === tasklistGuid)
    setEditingTasklistGuid(null)

    const currentName = currentProject?.name || currentTasklist?.name
    if (!currentName) {
      return
    }

    const nextName = rawName.trim() || currentName
    if (nextName === currentName) {
      return
    }

    try {
      const updated = await apiUpdateProject(tasklistGuid, { name: nextName })
      setProjects((prev) =>
        prev.map((p) => (p.project_id === tasklistGuid ? updated : p)),
      )
      const nextTasklist: Tasklist = {
        ...(currentTasklist || {
          guid: tasklistGuid,
          name: nextName,
          owner: { id: updated.creator_id, type: 'user' as const },
          creator: { id: updated.creator_id, type: 'user' as const },
          members: [],
          sections: [],
          custom_fields: [],
          archive_msec: '0',
          created_at: new Date(updated.created_at).getTime().toString(),
          updated_at: new Date(updated.updated_at).getTime().toString(),
          url: '',
        }),
        name: nextName,
      }
      onTasklistUpdated?.(nextTasklist)
      if (!onTasklistUpdated) {
        onTasklistsChange?.()
      }
    } catch {
      message.error('重命名清单失败')
    }
  }

  const handleStartRenameTasklist = (projectId: string) => {
    setOpenedProjectMenuId(null)
    setEditingTasklistGuid(projectId)
  }

  const handleDeleteTasklist = async (projectId: string) => {
    setOpenedProjectMenuId(null)
    try {
      await apiDeleteProject(projectId)
      setProjects((prev) => prev.filter((p) => p.project_id !== projectId))
      message.success('已删除清单')
      if (
        typeof activeKey === 'object' &&
        activeKey.type === 'tasklist' &&
        activeKey.guid === projectId
      ) {
        onNavigate('all-tasks')
      }
      onTasklistsChange?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除清单失败'
      message.error(msg)
    }
  }

  const handleArchiveTasklist = async (projectId: string) => {
    setOpenedProjectMenuId(null)
    try {
      await apiArchiveProject(projectId)
      setProjects((prev) => prev.filter((p) => p.project_id !== projectId))
      message.success('已归档清单')
      if (
        typeof activeKey === 'object' &&
        activeKey.type === 'tasklist' &&
        activeKey.guid === projectId
      ) {
        onNavigate('all-tasks')
      }
      onTasklistsChange?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '归档清单失败'
      message.error(msg)
    }
  }

  const handleOpenShareModal = async (project: Project) => {
    const requestId = shareRequestIdRef.current + 1
    shareRequestIdRef.current = requestId
    setOpenedProjectMenuId(null)
    setShareModalProject(project)
    setSelectedShareTeamIds([])
    setShareTargetTeams([])
    setShareTeamLoading(true)

    try {
      // 先拿到当前用户可见的团队，再按成员角色过滤出当前用户可管理的团队。
      const teams = await listTeams()
      const membersByTeam = await Promise.all(
        teams.map((team) => listMembers(team.team_id).catch(() => [])),
      )

      const manageableTeams = teams.filter((team, index) => {
        const member = membersByTeam[index]?.find(
          (item) => item.user_id === getConfig().user_id,
        )
        if (!member) {
          return false
        }
        return (
          team.team_id !== project.team_id &&
          (member.role === 'owner' || member.role === 'admin')
        )
      })

      if (shareRequestIdRef.current !== requestId) {
        return
      }
      setShareTargetTeams(manageableTeams)
    } catch (err: unknown) {
      if (shareRequestIdRef.current !== requestId) {
        return
      }
      const msg = err instanceof Error ? err.message : '加载可分享团队失败'
      message.error(msg)
    } finally {
      if (shareRequestIdRef.current === requestId) {
        setShareTeamLoading(false)
      }
    }
  }

  const handleCloseShareModal = (force = false) => {
    if (shareSubmitting && !force) {
      return
    }
    setShareModalProject(null)
    setShareTargetTeams([])
    setSelectedShareTeamIds([])
    shareRequestIdRef.current += 1
  }

  const handleSubmitShare = async () => {
    if (!shareModalProject) {
      return
    }
    if (selectedShareTeamIds.length === 0) {
      message.warning('请至少选择一个团队')
      return
    }

    setShareSubmitting(true)
    try {
      await distributeProject(shareModalProject.project_id, selectedShareTeamIds)
      message.success('分享成功')
      handleCloseShareModal(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '分享失败'
      message.error(msg)
    } finally {
      setShareSubmitting(false)
    }
  }

  const defaultGroup = useMemo(
    () => groups.find((g) => g.is_default),
    [groups],
  )

  const projectsByGroup = useMemo(() => {
    const map: Record<string, Project[]> = {}
    for (const p of projects) {
      const gid = p.group_id
      if (!map[gid]) map[gid] = []
      map[gid].push(p)
    }
    return map
  }, [projects])

  const ungroupedProjects = useMemo(
    () => defaultGroup ? (projectsByGroup[defaultGroup.group_id] || []) : projects.filter((p) => !groups.some((g) => g.group_id === p.group_id)),
    [projects, groups, defaultGroup, projectsByGroup],
  )

  const buildGroupActionMenu = (group: ProjectGroup) => ({
    items: [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: '重命名',
        disabled: group.is_default,
        onClick: () => handleStartRenameGroup(group.group_id),
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除',
        danger: true,
        disabled: group.is_default,
        onClick: () => {
          void handleDeleteGroup(group.group_id)
        },
      },
    ],
  })

  const buildTasklistActionMenu = (proj: Project): MenuProps => ({
    items: [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: '重命名清单',
        onClick: () => handleStartRenameTasklist(proj.project_id),
      },
      {
        key: 'share',
        icon: <ShareAltOutlined />,
        label: '分享',
        onClick: () => {
          void handleOpenShareModal(proj)
        },
      },
      { type: 'divider' },
      {
        key: 'archive',
        icon: <InboxOutlined />,
        label: '归档清单',
        onClick: () => {
          void handleArchiveTasklist(proj.project_id)
        },
      },
      {
        key: 'delete',
        icon: <StopOutlined />,
        label: '移除清单',
        danger: true,
        onClick: () => {
          void handleDeleteTasklist(proj.project_id)
        },
      },
    ],
  })

  const renderGroupTitle = (group: ProjectGroup) => {
    if (editingGroupId === group.group_id) {
      return (
        <EditableInput
          placeholder="输入清单分组名称"
          defaultValue={group.name}
          onSubmit={(v) => {
            void handleSaveGroupName(group.group_id, v)
          }}
        />
      )
    }
    return (
      <Flex align="center" justify="space-between" className="group-title-row">
        <Space size={8} className="group-title-main">
          <Text ellipsis className="group-name">
            {group.name}
          </Text>
        </Space>
        <Space size={2} className="group-actions">
          <Dropdown
            menu={buildGroupActionMenu(group)}
            trigger={['click']}
            onOpenChange={(open) => {
              setOpenedGroupMenuId(open ? group.group_id : null)
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<EllipsisOutlined />}
              className={`group-action-btn ${
                openedGroupMenuId === group.group_id ? 'always-visible' : ''
              }`}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            className="group-action-btn"
            loading={creatingTarget === group.group_id}
            onClick={(e) => {
              e.stopPropagation()
              void startCreateTasklist(group.group_id)
            }}
          />
        </Space>
      </Flex>
    )
  }

  const renderRootTitle = () => (
    <Flex align="center" justify="space-between" className="group-title-row">
      <Space size={8} className="group-title-main">
        <Text ellipsis className="group-name">
          任务清单
        </Text>
      </Space>
      <Space size={2} className="group-actions">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          className="group-action-btn"
          loading={creatingTarget === 'root'}
          onClick={(e) => {
            e.stopPropagation()
            void startCreateTasklist('root')
          }}
        />
      </Space>
    </Flex>
  )

  const renderProjectTitle = (proj: Project) => {
    const isActive =
      typeof activeKey === 'object' &&
      activeKey.type === 'tasklist' &&
      activeKey.guid === proj.project_id

    if (editingTasklistGuid === proj.project_id) {
      return (
        <div className="tasklist-title editing">
          <FileDoneOutlined className="tasklist-icon" />
          <div className="tasklist-name-editor">
            <EditableInput
              placeholder="输入清单名称"
              defaultValue={proj.name}
              onSubmit={(value) => {
                void handleRenameTasklist(proj.project_id, value)
              }}
            />
          </div>
        </div>
      )
    }

    return (
      <div
        className={`tasklist-title ${isActive ? 'active' : ''}`}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setEditingTasklistGuid(proj.project_id)
        }}
      >
        <FileDoneOutlined className="tasklist-icon" />
        <span className="tasklist-name">{proj.name}</span>
        <Dropdown
          menu={buildTasklistActionMenu(proj)}
          trigger={['click']}
          onOpenChange={(open) => {
            setOpenedProjectMenuId(open ? proj.project_id : null)
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<EllipsisOutlined />}
            className={`tasklist-action-btn ${
              openedProjectMenuId === proj.project_id ? 'always-visible' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      </div>
    )
  }

  const treeData = useMemo<DataNode[]>(() => {
    const rootChildren: DataNode[] = ungroupedProjects.map((proj) => ({
      key: encodeTasklistKey(proj.project_id),
      title: renderProjectTitle(proj),
      isLeaf: true,
      className: buildSidebarDragNodeClassName(
        encodeTasklistKey(proj.project_id),
        draggingTasklistKey,
        dropIndicatorState,
      ),
    }))

    const rootNode: DataNode = {
      key: 'root',
      title: renderRootTitle(),
      children: rootChildren,
      selectable: false,
      className: buildSidebarDragNodeClassName(
        'root',
        draggingTasklistKey,
        dropIndicatorState,
        'tree-section',
      ),
    }

    const nonDefaultGroups = [...groups]
      .filter((g) => !g.is_default)
      .sort((a, b) => a.sort_order - b.sort_order)
    const groupNodes: DataNode[] = nonDefaultGroups.map((group) => {
      const memberProjects = projectsByGroup[group.group_id] || []
      const children: DataNode[] = memberProjects.length > 0
        ? memberProjects.map((proj) => ({
            key: encodeTasklistKey(proj.project_id),
            title: renderProjectTitle(proj),
            isLeaf: true,
            className: buildSidebarDragNodeClassName(
              encodeTasklistKey(proj.project_id),
              draggingTasklistKey,
              dropIndicatorState,
            ),
          }))
        : [buildEmptyGroupPlaceholderNode(group.group_id)]

      return {
        key: encodeGroupKey(group.group_id),
        title: renderGroupTitle(group),
        children,
        selectable: false,
        className: buildSidebarDragNodeClassName(
          encodeGroupKey(group.group_id),
          draggingTasklistKey,
          dropIndicatorState,
          'tree-section',
        ),
        icon: ({ expanded }: { expanded?: boolean }) =>
          expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
      }
    })

    const draftNode: DataNode[] = draftGroupUid
      ? [
          {
            key: encodeGroupKey(draftGroupUid),
            title: (
              <EditableInput
                placeholder="输入清单分组名称"
                defaultValue=""
                onSubmit={(v) => {
                  void handleSaveGroupName(draftGroupUid, v)
                }}
              />
            ),
            children: [],
            selectable: false,
            className: buildSidebarDragNodeClassName(
              encodeGroupKey(draftGroupUid),
              draggingTasklistKey,
              dropIndicatorState,
              'tree-section',
            ),
          },
        ]
      : []

    return [rootNode, ...groupNodes, ...draftNode]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ungroupedProjects,
    groups,
    projects,
    projectsByGroup,
    draftGroupUid,
    editingGroupId,
    editingTasklistGuid,
    openedGroupMenuId,
    openedProjectMenuId,
    activeKey,
    draggingTasklistKey,
    dropIndicatorState,
  ])

  const selectableTreeKeySet = useMemo(() => {
    const keySet = new Set<string>()

    const walk = (nodes: DataNode[]) => {
      nodes.forEach((node) => {
        if (node.selectable !== false) {
          keySet.add(String(node.key))
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children)
        }
      })
    }

    walk(treeData)
    return keySet
  }, [treeData])

  const selectedKeys = useMemo<React.Key[]>(() => {
    if (typeof activeKey === 'object' && activeKey.type === 'tasklist') {
      const nextKey = encodeTasklistKey(activeKey.guid)
      // Tree 内部会对受控 selectedKeys 做滚动定位，节点尚未渲染出来时要先拦住不存在的 key。
      return selectableTreeKeySet.has(nextKey) ? [nextKey] : []
    }
    return []
  }, [activeKey, selectableTreeKeySet])

  const handleSelect: TreeProps['onSelect'] = (_keys, info) => {
    const key = String(info.node.key)
    if (key.startsWith('tl:')) {
      onNavigate({ type: 'tasklist', guid: key.slice(3) })
    }
  }

  const handleExpand: TreeProps['onExpand'] = (keys) => {
    setExpandedKeys(keys)
  }

  const handleDrop: TreeProps['onDrop'] = (info) => {
    const dragKey = String(info.dragNode.key)

    // Group node drag → reorder groups
    if (dragKey.startsWith('grp:')) {
      const dragGroupId = dragKey.slice(4)
      const ordered = [...groups].sort((a, b) => a.sort_order - b.sort_order)
      const fromIndex = ordered.findIndex((g) => g.group_id === dragGroupId)
      if (fromIndex === -1) return

      const dropKey = String(info.node.key)
      if (!dropKey.startsWith('grp:')) return
      const dropGroupId = dropKey.slice(4)
      const dropIndex = ordered.findIndex((g) => g.group_id === dropGroupId)
      if (dropIndex === -1) return

      let targetIndex: number
      if (info.dropPosition === -1) {
        targetIndex = dropIndex
      } else {
        targetIndex = dropIndex + 1
      }
      if (fromIndex < targetIndex) targetIndex -= 1
      if (targetIndex === fromIndex) return

      const without = ordered.filter((_, i) => i !== fromIndex)
      const prev = targetIndex > 0 ? without[targetIndex - 1] : undefined
      const next = without[targetIndex] as ProjectGroup | undefined
      let newSortOrder: number
      if (!prev && !next) newSortOrder = 1024
      else if (!prev) newSortOrder = next!.sort_order - 1024
      else if (!next) newSortOrder = prev.sort_order + 1024
      else newSortOrder = (prev.sort_order + next.sort_order) / 2

      const prevGroups = groups
      setGroups((prev) =>
        prev.map((g) =>
          g.group_id === dragGroupId ? { ...g, sort_order: newSortOrder } : g,
        ),
      )

      updateGroupSortOrder(dragGroupId, newSortOrder).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '操作失败'
        message.error(msg)
        setGroups(prevGroups)
      })
      return
    }

    // Tasklist node drag → determine target group
    if (!dragKey.startsWith('tl:')) return
    const projectId = dragKey.slice(3)
    const dropKey = String(info.node.key)
    const currentProject = projects.find((p) => p.project_id === projectId)
    if (!currentProject) return

    let targetGroupId: string | null = null

    if (dropKey.startsWith('grp:')) {
      // Dropped onto a group node (whether gap or into)
      targetGroupId = dropKey.slice(4)
    } else if (dropKey.startsWith(EMPTY_GROUP_PLACEHOLDER_PREFIX)) {
      // Dropped onto空分组占位提示行时，仍然落到该分组。
      targetGroupId = dropKey.slice(EMPTY_GROUP_PLACEHOLDER_PREFIX.length)
    } else if (dropKey === 'root') {
      // Dropped onto the root "任务清单" section → default group
      targetGroupId = defaultGroup?.group_id ?? null
    } else if (dropKey.startsWith('tl:')) {
      // Dropped next to another tasklist → use that tasklist's group
      const droppedProjectId = dropKey.slice(3)
      const ownerProject = projects.find((p) => p.project_id === droppedProjectId)
      targetGroupId = ownerProject?.group_id ?? defaultGroup?.group_id ?? null
    }

    if (!targetGroupId) return

    // If the target group is the same as current, we treat it as local-only reorder.
    // (Backend has no project sort_order endpoint, so order isn't persisted.)
    if (currentProject.group_id === targetGroupId) {
      // reorder: rebuild projects array so the dragged one lands at the drop position
      const sameGroup = projects.filter((p) => p.group_id === targetGroupId)
      const others = projects.filter((p) => p.group_id !== targetGroupId)
      const fromIndex = sameGroup.findIndex((p) => p.project_id === projectId)
      if (fromIndex === -1) return

      let toIndex: number
      if (dropKey.startsWith('tl:')) {
        const droppedProjectId = dropKey.slice(3)
        const dropIndex = sameGroup.findIndex((p) => p.project_id === droppedProjectId)
        if (dropIndex === -1) return
        toIndex = info.dropPosition === -1 ? dropIndex : dropIndex + 1
      } else {
        // Dropped onto group/root gap → append to end
        toIndex = sameGroup.length
      }

      if (fromIndex < toIndex) toIndex -= 1
      if (toIndex === fromIndex) return

      const reordered = [...sameGroup]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)
      setProjects([...others, ...reordered])
      return
    }

    // Different group → optimistic update + API call
    const prevProjects = projects
    setProjects((prev) =>
      prev.map((p) =>
        p.project_id === projectId ? { ...p, group_id: targetGroupId! } : p,
      ),
    )

    moveProjectToGroup(projectId, targetGroupId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : '操作失败'
      message.error(msg)
      setProjects(prevProjects)
    })
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Tooltip title="收起侧边栏" placement="right">
          <Button
            type="text"
            size="small"
            icon={<UnorderedListOutlined />}
            onClick={onToggleCollapse}
            className="sidebar-toggle-btn"
          />
        </Tooltip>
        <Title level={5} className="sidebar-title">
          任务
        </Title>
        <div style={{ marginLeft: 'auto' }}>
          <NotificationBell />
        </div>
      </div>

      <Menu
        mode="inline"
        items={topMenuItems}
        selectedKeys={[selectedMenuKey]}
        onClick={handleMenuClick}
        className="sidebar-menu"
      />

      <Divider className="sidebar-divider" />

      <Menu
        mode="inline"
        items={quickAccessItems}
        selectedKeys={[selectedMenuKey]}
        onClick={handleMenuClick}
        className="sidebar-menu"
      />

      <Divider className="sidebar-divider" />

      <div className="tasklist-tree-wrap">
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          selectedKeys={selectedKeys}
          onSelect={handleSelect}
          onExpand={handleExpand}
          blockNode
          showLine={false}
          draggable={{
            icon: <DragOutlined className="tasklist-drag-handle" />,
            nodeDraggable: (node) => {
              const k = String(node.key)
              return k.startsWith('tl:') || k.startsWith('grp:')
            },
          }}
          allowDrop={({ dragNode, dropNode, dropPosition }) => {
            const dragKey = String(dragNode.key)
            const dropKey = String(dropNode.key)
            // Group nodes can only reorder among other groups (gap drop, not into)
            if (dragKey.startsWith('grp:')) {
              return dropKey.startsWith('grp:') && dropPosition !== 0
            }
            // Tasklist nodes:
            //   - can drop into a group (dropPosition === 0 on a group) → move to that group
            //   - can drop as sibling of another tasklist (gap drop) → reorder/change group
            //   - can drop into root → move to default group
            if (dragKey.startsWith('tl:')) {
              if (dropKey.startsWith('grp:')) return true
              if (dropKey.startsWith(EMPTY_GROUP_PLACEHOLDER_PREFIX)) return true
              if (dropKey.startsWith('tl:')) return dropPosition !== 0
              if (dropKey === 'root') return true
              return false
            }
            return false
          }}
          dropIndicatorRender={(props) => {
            if (!dropIndicatorState || props.dropPosition === 0) {
              return null
            }
            const placement =
              props.dropPosition === -1
                ? 'drag-drop-indicator gap-top'
                : props.dropPosition === 1
                  ? 'drag-drop-indicator gap-bottom'
                  : ''
            return (
              <div
                style={{
                  left: -props.dropLevelOffset * props.indent + 8,
                  right: 10,
                }}
                className={placement}
              />
            )
          }}
          onDragStart={(info) => {
            setDraggingTasklistKey(String(info.node.key))
            setDropIndicatorState(null)
          }}
          onDragOver={(info) => {
            const nodeKey = String(info.node.key)
            const nativeEvent = info.event.nativeEvent as DragEvent
            const dropPosition =
              typeof nativeEvent.offsetY === 'number'
                ? nativeEvent.offsetY < 10
                  ? -1
                  : nativeEvent.offsetY > 24
                    ? 1
                    : 0
                : 0
            setDropIndicatorState({
              key: nodeKey,
              dropPosition,
            })
          }}
          onDragEnd={() => {
            setDraggingTasklistKey(null)
            setDropIndicatorState(null)
          }}
          onDrop={handleDrop}
          switcherIcon={({ expanded }) =>
            expanded ? <CaretDownOutlined /> : <CaretRightOutlined />
          }
        />
      </div>

      <div className="create-group-wrap">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => void handleStartCreateGroup()}
          block
          className="create-group-btn"
        >
          新建清单分组
        </Button>
      </div>

      <CustomFieldsModal
        open={!!customFieldsProjectId}
        projectId={customFieldsProjectId ?? ''}
        onClose={() => setCustomFieldsProjectId(null)}
      />

      <Modal
        title="分享清单"
        open={!!shareModalProject}
        confirmLoading={shareSubmitting}
        okText="确认分享"
        cancelText="取消"
        onCancel={() => handleCloseShareModal()}
        onOk={() => {
          void handleSubmitShare()
        }}
      >
        <div className="tasklist-share-modal">
          <div className="tasklist-share-modal__summary">
            {shareModalProject
              ? `把“${shareModalProject.name}”分享给其他可管理团队。`
              : ''}
          </div>
          <div className="tasklist-share-modal__field">
            <div className="tasklist-share-modal__label">选择团队</div>
            {shareTeamLoading ? (
              <div className="tasklist-share-modal__loading">
                <Spin size="small" />
              </div>
            ) : (
              <Select
                mode="multiple"
                allowClear
                showSearch
                placeholder="请选择要分享到的团队"
                value={selectedShareTeamIds}
                onChange={setSelectedShareTeamIds}
                options={shareTargetTeams.map((team) => ({
                  label: `${team.name} (${team.team_id})`,
                  value: team.team_id,
                }))}
                notFoundContent="当前没有可管理的其他团队"
                maxTagCount="responsive"
              />
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
