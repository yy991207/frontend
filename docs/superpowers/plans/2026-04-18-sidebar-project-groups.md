# Sidebar 任务分组管理接入后端 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Sidebar 中的任务分组（新建/重命名/删除/排序）从纯本地状态改为调用后端 project-groups API。

**Architecture:** 新建 `config.yaml`（gitignored）存放后端配置；`appConfig.ts` 解析；`request.ts` 统一 fetch 封装（自动补鉴权头、剥 ApiResponse 壳）；`projectGroupService.ts` 暴露 5 个 API 函数；Sidebar 组件里用 `useEffect` 拉分组列表、CRUD 操作走真实接口、清单归属仍为本地状态。

**Tech Stack:** React 19 + TypeScript + Ant Design 6 + Vite 8 + Less

**Spec:** `docs/superpowers/specs/2026-04-18-sidebar-project-groups-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `config.yaml` | 后端配置（gitignored） |
| Create | `config.yaml.example` | 配置模板 |
| Modify | `.gitignore` | 追加 `config.yaml` |
| Modify | `src/vite-env.d.ts` | 追加 `*.yaml?raw` 类型声明 |
| Create | `src/config/appConfig.ts` | 解析 `config.yaml` 为 typed config 对象 |
| Create | `src/services/request.ts` | 统一 fetch 封装（url 拼接、鉴权头、ApiResponse 解包、错误抛出） |
| Create | `src/types/projectGroup.ts` | `ProjectGroup` 接口类型 |
| Create | `src/services/projectGroupService.ts` | 5 个 API 函数 + `computeDropSortOrder` 工具 |
| Modify | `src/components/Sidebar/index.tsx` | 接入后端分组 CRUD |

---

## Task A: 基础设施（配置 + 请求封装）

**Files:**
- Create: `config.yaml`
- Create: `config.yaml.example`
- Modify: `.gitignore`
- Modify: `src/vite-env.d.ts`
- Create: `src/config/appConfig.ts`
- Create: `src/services/request.ts`

- [ ] **Step 1: 创建 `config.yaml`**

```yaml
user_id: 123456
team_id: team_2045386262310813696
url: http://192.168.30.238:8000/
token:
```

- [ ] **Step 2: 创建 `config.yaml.example`**

```yaml
user_id: your_user_id
team_id: your_team_id
url: http://127.0.0.1:8000/
token: your_token_here
```

- [ ] **Step 3: `.gitignore` 追加 `config.yaml`**

在文件末尾追加：

```
config.yaml
```

- [ ] **Step 4: `src/vite-env.d.ts` 追加 `*.yaml?raw` 声明**

现有内容保留，追加：

```ts
declare module '*.yaml?raw' {
  const content: string
  export default content
}
```

完整文件变为：

```ts
/// <reference types="vite/client" />

declare module '*.module.less' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.yaml?raw' {
  const content: string
  export default content
}
```

- [ ] **Step 5: 创建 `src/config/appConfig.ts`**

```ts
import yaml from '../../config.yaml?raw'

interface AppConfig {
  url: string
  user_id: string
  team_id: string
  token: string
}

function parseYaml(raw: string): AppConfig {
  const result: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(':')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key) result[key] = value
  }
  return result as unknown as AppConfig
}

export const appConfig = parseYaml(yaml)
```

- [ ] **Step 6: 创建 `src/services/request.ts`**

```ts
import { appConfig } from '@/config/appConfig'

export interface ApiResponse<T> {
  success: boolean
  code: string
  msg: string
  data: T
}

function buildUrl(path: string): string {
  const base = appConfig.url.replace(/\/+$/, '')
  const p = path.replace(/^\/+/, '')
  return `${base}/${p}`
}

function authHeaders(): HeadersInit {
  return appConfig.token ? { Authorization: `Bearer ${appConfig.token}` } : {}
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isJsonBody = options?.body && !(options.body instanceof FormData)
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...authHeaders(),
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  })
  const json: ApiResponse<T> = await res.json()
  if (!json.success) {
    throw new Error(json.msg || `请求失败 (${json.code})`)
  }
  return json.data
}
```

- [ ] **Step 7: 验证构建**

Run: `cd /Users/yang/feishu_task && npx tsc --noEmit`
Expected: 无类型错误。

---

## Task B: API 层（类型 + 服务函数）

**Files:**
- Create: `src/types/projectGroup.ts`
- Create: `src/services/projectGroupService.ts`

依赖：Task A 完成后的 `request.ts` 和 `appConfig.ts`。

- [ ] **Step 1: 创建 `src/types/projectGroup.ts`**

```ts
export interface ProjectGroup {
  group_id: string
  name: string
  sort_order: number
  is_default: boolean
  created_at?: string
  updated_at?: string
  team_id?: string
}
```

- [ ] **Step 2: 创建 `src/services/projectGroupService.ts`**

```ts
import { request } from './request'
import { appConfig } from '@/config/appConfig'
import type { ProjectGroup } from '@/types/projectGroup'

export function listProjectGroups(): Promise<ProjectGroup[]> {
  return request<ProjectGroup[]>(
    `api/v1/task-center/teams/${appConfig.team_id}/project-groups` +
      `?user_id=${encodeURIComponent(appConfig.user_id)}`,
  )
}

export function createProjectGroup(name: string): Promise<ProjectGroup> {
  return request<ProjectGroup>(
    `api/v1/task-center/teams/${appConfig.team_id}/project-groups`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: appConfig.user_id, name }),
    },
  )
}

export function updateProjectGroup(groupId: string, name: string): Promise<ProjectGroup> {
  return request<ProjectGroup>(
    `api/v1/task-center/project-groups/${groupId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ user_id: appConfig.user_id, name }),
    },
  )
}

export function deleteProjectGroup(groupId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/project-groups/${groupId}` +
      `?user_id=${encodeURIComponent(appConfig.user_id)}`,
    { method: 'DELETE' },
  )
}

export function updateGroupSortOrder(
  groupId: string,
  sortOrder: number,
): Promise<void> {
  return request<void>(
    `api/v1/task-center/project-groups/${groupId}/sort-order`,
    {
      method: 'PATCH',
      body: JSON.stringify({ user_id: appConfig.user_id, sort_order: sortOrder }),
    },
  )
}

export function computeDropSortOrder(
  ordered: ProjectGroup[],
  fromIndex: number,
  toIndex: number,
): number {
  const without = ordered.filter((_, i) => i !== fromIndex)
  const prev = toIndex > 0 ? without[toIndex - 1] : undefined
  const next = without[toIndex] as ProjectGroup | undefined
  if (!prev && !next) return 1024
  if (!prev) return next!.sort_order - 1024
  if (!next) return prev.sort_order + 1024
  return (prev.sort_order + next.sort_order) / 2
}
```

- [ ] **Step 3: 验证构建**

Run: `cd /Users/yang/feishu_task && npx tsc --noEmit`
Expected: 无类型错误。

---

## Task C: Sidebar 接入

**Files:**
- Modify: `src/components/Sidebar/index.tsx`

依赖：Task A + Task B 完成。

### 改动要点

1. 导入后端 service 函数和 `ProjectGroup` 类型。
2. 移除本地 `TasklistGroup` 接口（用 `ProjectGroup` 替代）。
3. 新增 `groups: ProjectGroup[]` state 替代 `tasklistGroups`。
4. 新增 `groupMembership: Record<string, string[]>` 替代原 `tasklistGroups[].tasklistIds`。
5. `useEffect` 首次拉 `listProjectGroups()`。
6. 新建分组改为"草稿→接口落库"两步。
7. 重命名/删除走真实接口，默认分组置灰。
8. 分组拖拽走 `updateGroupSortOrder`。
9. 清单拖拽保持本地 `groupMembership` 不变。

- [ ] **Step 1: 替换导入和类型**

在文件顶部新增导入：

```ts
import { useEffect } from 'react'
import type { ProjectGroup } from '@/types/projectGroup'
import {
  listProjectGroups,
  createProjectGroup,
  updateProjectGroup as apiUpdateProjectGroup,
  deleteProjectGroup as apiDeleteProjectGroup,
  updateGroupSortOrder,
  computeDropSortOrder,
} from '@/services/projectGroupService'
```

移除本地 `TasklistGroup` 接口定义（原第 54–58 行）。

更新 `useEffect` 导入（`useState` 旁边加 `useEffect`，原文已导 `useState` 和 `useMemo`）。

- [ ] **Step 2: 替换 state**

将原来的：
```ts
const [tasklistGroups, setTasklistGroups] = useState<TasklistGroup[]>([])
```

替换为：
```ts
const [groups, setGroups] = useState<ProjectGroup[]>([])
const [groupMembership, setGroupMembership] = useState<Record<string, string[]>>({})
```

保留 `editingGroupId`、`editingTasklistGuid`、`openedGroupMenuId`、`openedCreateTarget`、`expandedKeys` 不变。

新增草稿 uid state：
```ts
const [draftGroupUid, setDraftGroupUid] = useState<string | null>(null)
```

- [ ] **Step 3: 添加首次加载 useEffect**

在组件函数体内、所有 handler 之前：

```ts
useEffect(() => {
  let alive = true
  listProjectGroups()
    .then((list) => {
      if (!alive) return
      setGroups([...list].sort((a, b) => a.sort_order - b.sort_order))
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : '加载分组失败'
      message.error(msg)
    })
  return () => { alive = false }
}, [])
```

- [ ] **Step 4: 修改 `handleStartCreateGroup`**

替换为草稿+接口模式：

```ts
const handleStartCreateGroup = () => {
  if (draftGroupUid) return
  const uid = `draft_${Math.random().toString(36).slice(2, 9)}`
  setDraftGroupUid(uid)
  setExpandedKeys((prev) =>
    prev.includes(encodeGroupKey(uid)) ? prev : [...prev, encodeGroupKey(uid)],
  )
  setEditingGroupId(uid)
}
```

- [ ] **Step 5: 修改 `handleSaveGroupName`**

替换为：

```ts
const handleSaveGroupName = async (groupId: string, rawName: string) => {
  const name = rawName.trim()

  // 草稿节点
  if (groupId === draftGroupUid) {
    setEditingGroupId(null)
    setDraftGroupUid(null)
    if (!name || name.length > 50) {
      if (name.length > 50) message.warning('分组名称需 1–50 个字符')
      return
    }
    try {
      const created = await createProjectGroup(name)
      setGroups((prev) => [...prev, created])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建分组失败'
      message.error(msg)
    }
    return
  }

  // 已有分组重命名
  const existing = groups.find((g) => g.group_id === groupId)
  setEditingGroupId(null)
  if (!name || name.length > 50) {
    if (name && name.length > 50) message.warning('分组名称需 1–50 个字符')
    return
  }
  if (existing && name === existing.name) return

  try {
    const updated = await apiUpdateProjectGroup(groupId, name)
    setGroups((prev) =>
      prev.map((g) => (g.group_id === groupId ? { ...g, name: updated.name } : g)),
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '重命名分组失败'
    message.error(msg)
  }
}
```

- [ ] **Step 6: 修改 `handleDeleteGroup`**

替换为：

```ts
const handleDeleteGroup = async (groupId: string) => {
  setOpenedGroupMenuId(null)
  try {
    await apiDeleteProjectGroup(groupId)
    setGroups((prev) => prev.filter((g) => g.group_id !== groupId))
    setEditingGroupId((prev) => (prev === groupId ? null : prev))
    setGroupMembership((prev) => {
      const next = { ...prev }
      delete next[groupId]
      return next
    })
    message.success('已删除分组')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '删除分组失败'
    message.error(msg)
  }
}
```

- [ ] **Step 7: 修改 `handleStartRenameGroup`**

保持不变（原逻辑已正确）：

```ts
const handleStartRenameGroup = (groupId: string) => {
  setOpenedGroupMenuId(null)
  setEditingGroupId(groupId)
}
```

- [ ] **Step 8: 修改 `buildGroupActionMenu`**

增加默认分组的 `disabled` 判断：

```ts
const buildGroupActionMenu = (groupId: string) => {
  const group = groups.find((g) => g.group_id === groupId)
  const isDefault = group?.is_default ?? false
  return {
    items: [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: '重命名分组',
        disabled: isDefault,
        onClick: () => handleStartRenameGroup(groupId),
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除分组',
        danger: true,
        disabled: isDefault,
        onClick: () => { void handleDeleteGroup(groupId) },
      },
    ],
  }
}
```

- [ ] **Step 9: 修改 `ungroupedTasklists` 和 `groupedTasklistIds` 计算**

将原来的基于 `tasklistGroups` 改为基于 `groupMembership`：

```ts
const groupedTasklistIds = useMemo(
  () => new Set(Object.values(groupMembership).flat()),
  [groupMembership],
)
const ungroupedTasklists = useMemo(
  () => tasklists.filter((tl) => !groupedTasklistIds.has(tl.guid)),
  [tasklists, groupedTasklistIds],
)
```

- [ ] **Step 10: 修改 `renderGroupTitle`**

将 `group: TasklistGroup` → 按新数据结构适配。对 `editingGroupId` 等于草稿 uid 或真实 group_id 的都进入编辑态：

```ts
const renderGroupTitle = (group: ProjectGroup) => {
  if (editingGroupId === group.group_id) {
    return (
      <EditableInput
        placeholder="输入分组名称"
        defaultValue={group.name}
        onSubmit={(v) => { void handleSaveGroupName(group.group_id, v) }}
      />
    )
  }
  return (
    <Flex align="center" justify="space-between" className="group-title-row">
      <Text ellipsis className="group-name">
        {group.name}
      </Text>
      <Space size={2} className="group-actions">
        <Dropdown
          menu={buildGroupActionMenu(group.group_id)}
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
        <Dropdown
          menu={buildCreateMenu(group.group_id)}
          trigger={['click']}
          onOpenChange={(open) => {
            setOpenedCreateTarget(open ? group.group_id : null)
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            className={`group-action-btn ${
              openedCreateTarget === group.group_id ? 'always-visible' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      </Space>
    </Flex>
  )
}
```

- [ ] **Step 11: 修改 `treeData` 计算**

替换 `groupNodes` 构建逻辑，使用 `groups` + `groupMembership`：

```ts
const nonDefaultGroups = groups.filter((g) => !g.is_default)
const allGroupNodes: (ProjectGroup | { group_id: string; name: string; is_default: false; sort_order: number })[] = [
  ...nonDefaultGroups,
  ...(draftGroupUid ? [{ group_id: draftGroupUid, name: '', is_default: false as const, sort_order: Infinity }] : []),
]

const groupNodes: DataNode[] = allGroupNodes.map((group) => {
  const memberGuids = groupMembership[group.group_id] ?? []
  const children: DataNode[] = memberGuids
    .map((id) => tasklists.find((t) => t.guid === id))
    .filter(isTasklist)
    .map((tl) => ({
      key: encodeTasklistKey(tl.guid),
      title: renderTasklistTitle(tl),
      isLeaf: true,
    }))

  return {
    key: encodeGroupKey(group.group_id),
    title: renderGroupTitle(group as ProjectGroup),
    children,
    selectable: false,
    className: 'tree-section',
    icon: ({ expanded }: { expanded?: boolean }) =>
      expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
  }
})

return [rootNode, ...groupNodes]
```

`useMemo` 依赖数组更新为：

```ts
[
  ungroupedTasklists,
  groups,
  groupMembership,
  draftGroupUid,
  tasklists,
  editingGroupId,
  editingTasklistGuid,
  openedGroupMenuId,
  openedCreateTarget,
  activeKey,
]
```

- [ ] **Step 12: 修改 `handleDrop`**

拖拽分组节点时调后端排序，拖拽清单节点时只改本地：

```ts
const handleDrop: TreeProps['onDrop'] = (info) => {
  const dragKey = String(info.dragNode.key)
  const dropKey = String(info.node.key)

  // 分组拖拽排序
  if (dragKey.startsWith('grp:')) {
    const dragGroupId = dragKey.slice(4)
    const dragGroup = groups.find((g) => g.group_id === dragGroupId)
    if (!dragGroup || dragGroup.is_default) return

    const nonDefault = groups.filter((g) => !g.is_default)
    const fromIndex = nonDefault.findIndex((g) => g.group_id === dragGroupId)
    if (fromIndex === -1) return

    let toIndex = fromIndex
    if (dropKey.startsWith('grp:')) {
      const dropGroupId = dropKey.slice(4)
      toIndex = nonDefault.findIndex((g) => g.group_id === dropGroupId)
    }
    if (toIndex === -1 || toIndex === fromIndex) return

    const newSortOrder = computeDropSortOrder(nonDefault, fromIndex, toIndex)
    const prev = [...groups]

    setGroups((gs) => {
      const updated = gs.map((g) =>
        g.group_id === dragGroupId ? { ...g, sort_order: newSortOrder } : g,
      )
      return updated.sort((a, b) => a.sort_order - b.sort_order)
    })

    updateGroupSortOrder(dragGroupId, newSortOrder).catch((err: unknown) => {
      setGroups(prev)
      const msg = err instanceof Error ? err.message : '排序失败'
      message.error(msg)
    })
    return
  }

  // 清单拖拽归属（保持本地）
  if (!dragKey.startsWith('tl:')) return
  const tasklistGuid = dragKey.slice(3)

  let targetGroupId: string | null = null
  if (dropKey.startsWith('grp:')) {
    targetGroupId = dropKey.slice(4)
  } else if (dropKey.startsWith('tl:')) {
    const guid = dropKey.slice(3)
    const ownerGroupId = Object.entries(groupMembership).find(([, ids]) =>
      ids.includes(guid),
    )?.[0]
    targetGroupId = ownerGroupId ?? null
  }

  setGroupMembership((prev) => {
    const next: Record<string, string[]> = {}
    for (const [gid, ids] of Object.entries(prev)) {
      next[gid] = ids.filter((id) => id !== tasklistGuid)
    }
    if (targetGroupId) {
      next[targetGroupId] = [...(next[targetGroupId] ?? []), tasklistGuid]
    }
    return next
  })
}
```

- [ ] **Step 13: 修改 `startCreateTasklist`**

原来函数体内 `target !== 'root'` 分支用 `setTasklistGroups`，改为 `setGroupMembership`：

```ts
const startCreateTasklist = async (target: CreatingTarget) => {
  if (creatingTarget) return
  setCreatingTarget(target)
  const expandKey = target === 'root' ? 'root' : encodeGroupKey(target)
  setExpandedKeys((prev) =>
    prev.includes(expandKey) ? prev : [...prev, expandKey],
  )

  try {
    const tasklist = await createTasklist(generateDefaultTasklistName(tasklists))
    if (target !== 'root') {
      setGroupMembership((prev) => ({
        ...prev,
        [target]: [...(prev[target] ?? []), tasklist.guid],
      }))
    }
    setEditingTasklistGuid(tasklist.guid)
    onTasklistCreated?.(tasklist)
    if (!onTasklistCreated) {
      onTasklistsChange?.()
      onNavigate({ type: 'tasklist', guid: tasklist.guid })
    }
  } catch {
    message.error('创建清单失败')
  } finally {
    setCreatingTarget(null)
  }
}
```

- [ ] **Step 14: 验证构建和 lint**

Run: `cd /Users/yang/feishu_task && npm run lint && npm run build`
Expected: 无错误。

---

## Task D: 集成检查

依赖：Task A + B + C 全部完成。

- [ ] **Step 1: 验证构建**

Run: `cd /Users/yang/feishu_task && npm run lint && npm run build`
Expected: 无错误。

- [ ] **Step 2: 启动 dev server 并在浏览器中验证**

Run: `cd /Users/yang/feishu_task && npm run dev`

用 playwright 或 chrome-devtools 检查：

1. Sidebar 首次渲染发出 `GET .../project-groups` 请求。
2. 点 `+ 新建分组` → 输入名称 → 回车 → 发 POST → 分组出现。
3. 默认分组（`is_default`）的 `...` 菜单中重命名和删除是 disabled 的。
4. 非默认分组可重命名（PUT）、删除（DELETE）。
5. 分组可拖拽排序（PATCH sort-order）。
6. 清单拖拽进/出分组不发网络请求。

- [ ] **Step 3: 修复联调中发现的字段不一致**

后端 openapi 的 response schema 为空 `{}`。如果实际返回中 `is_default` 字段名不同（比如叫 `is_system` 或 `default`），在 `src/types/projectGroup.ts` 里统一适配。

如果后端 list 接口返回的不是数组而是 `{ groups: [...] }` 之类包装，在 `projectGroupService.ts` 的 `listProjectGroups` 里做一层 `.groups` 解包。
