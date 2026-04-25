# Sidebar 任务分组管理接入后端 — 设计文档

- 日期：2026-04-18
- 范围：`feishu_task` 前端
- 关联接口：`/api/v1/task-center/.../project-groups`（5 个）

## 1. 背景

当前 `src/components/Sidebar/index.tsx` 里"新建分组 / 重命名 / 删除 / 拖拽归属"
全部走本地 `useState`，刷新即丢。

后端 `task-center` 已经提供了完整的 project-group CRUD：

| Method | Path | 用途 |
|--------|------|------|
| GET    | `/api/v1/task-center/teams/{team_id}/project-groups` | 列表，默认分组"未分组"排最前 |
| POST   | `/api/v1/task-center/teams/{team_id}/project-groups` | 创建分组 |
| PUT    | `/api/v1/task-center/project-groups/{group_id}`      | 重命名（默认分组不可改名） |
| DELETE | `/api/v1/task-center/project-groups/{group_id}`      | 删除（默认分组不可删；其下 project 自动归入默认分组）|
| PATCH  | `/api/v1/task-center/project-groups/{group_id}/sort-order` | 拖拽排序 |

本轮只对接**分组本身**的 CRUD + 排序。分组内的"清单归属"继续走当前前端本地
`groupMembership` 状态（即不改 `tasklist` mock，也不调后端 `projects` 接口）。

## 2. 范围与取舍

### 做的事

- 新增 `config.yaml`（gitignored）承载后端配置（url / user_id / team_id / token）。
- 新增 `src/config/appConfig.ts` 解析 `config.yaml`。
- 新增 `src/services/request.ts` 统一 fetch 封装（补 Authorization、剥 ApiResponse 壳）。
- 新增 `src/services/projectGroupService.ts` 5 个函数。
- 新增 `src/types/projectGroup.ts` 类型定义。
- 新增 `src/vite-env.d.ts` 中的 `*.yaml?raw` 声明（若已存在则合并）。
- 修改 `src/components/Sidebar/index.tsx`：
  - 首次渲染拉分组列表。
  - 新建/重命名/删除/拖拽排序走真实接口。
  - 默认分组（`is_default`）的"重命名"、"删除"菜单项置灰。
  - 拖拽清单进/出分组**保持本地状态**，不触发网络请求。
- 新增 `config.yaml.example` 模板。
- `.gitignore` 追加 `config.yaml`。

### 不做的事（YAGNI）

- 不动 `src/mock/api.ts`、`tasklist` 数据结构、TaskTable/TaskDetailPanel。
- 不新增 team 选择器，`team_id` 从 `config.yaml` 写死读取。
- 不为"分组 → 清单归属"做持久化（刷新即丢是已知取舍）。
- 不做全局 error boundary / 请求重试；错误统一 `message.error` 即可。
- 不做 e2e 测试，只做 `lint` + `build` + 手动冒烟。

## 3. 配置

### `config.yaml`（新增，gitignored）

```yaml
user_id: 123456
team_id: team_2045386262310813696
url: http://192.168.30.238:8000/
token: <可选，若后端需要>
```

### `config.yaml.example`（新增，入库）

```yaml
user_id: your_user_id
team_id: your_team_id
url: http://127.0.0.1:8000/
token: your_token_here
```

### `.gitignore`

追加一行：`config.yaml`

## 4. 基础设施

### `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />
declare module '*.yaml?raw' {
  const content: string
  export default content
}
```

### `src/config/appConfig.ts`

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

### `src/services/request.ts`

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

成功时直接返回 `data`；失败时抛 `Error`。调用方只 `try/catch` 即可。

## 5. API 层

### `src/types/projectGroup.ts`

```ts
export interface ProjectGroup {
  group_id: string
  name: string
  sort_order: number
  is_default: boolean
  // 兼容后端可能返回的附加字段
  created_at?: string
  updated_at?: string
  team_id?: string
}
```

> 注：后端 openapi 里 project-group 响应 schema 是空的 `{}`。如果实际联调发现
> `is_default` 字段名不同（例如 `is_system` / `default`），在这里统一适配即可。

### `src/services/projectGroupService.ts`

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
```

### `computeDropSortOrder` 工具

放在 `src/services/projectGroupService.ts` 同文件，导出：

```ts
export function computeDropSortOrder(
  ordered: ProjectGroup[], // 升序（sort_order 递增）
  fromIndex: number,
  toIndex: number,         // 插入位，0..ordered.length
): number {
  const without = ordered.filter((_, i) => i !== fromIndex)
  const prev = toIndex > 0 ? without[toIndex - 1] : undefined
  const next = without[toIndex]
  if (!prev && !next) return 1024
  if (!prev) return next!.sort_order - 1024
  if (!next) return prev.sort_order + 1024
  return (prev.sort_order + next.sort_order) / 2
}
```

## 6. Sidebar 改动

### 6.1 state

```ts
const [groups, setGroups] = useState<ProjectGroup[]>([])
const [groupsLoading, setGroupsLoading] = useState(false)
const [draftGroupUid, setDraftGroupUid] = useState<string | null>(null) // 用前端草稿 uid
// 原本的 tasklistGroups 改名为 groupMembership，只保留 group_id -> guid[] 的归属映射
const [groupMembership, setGroupMembership] = useState<Record<string, string[]>>({})
```

### 6.2 加载

组件挂载：
```ts
useEffect(() => {
  let alive = true
  setGroupsLoading(true)
  listProjectGroups()
    .then((list) => {
      if (!alive) return
      const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order)
      setGroups(sorted)
    })
    .catch((err) => message.error(err?.message || '加载分组失败'))
    .finally(() => {
      if (alive) setGroupsLoading(false)
    })
  return () => { alive = false }
}, [])
```

### 6.3 新建分组（草稿模式）

- 按钮点击：push 一个草稿节点 `{ group_id: 'draft_xxx', name: '', sort_order: Infinity, is_default: false, _draft: true }` 到 UI 列表（不进 `groups` state，单独 `draftGroup` 也可以；这里用 `draftGroupUid` 标记）。
- 渲染时把草稿节点当作 editing 状态。
- `onSubmit(name)`：
  - 若 `name.trim()` 为空：从草稿里撤掉，结束。
  - 否则：`createProjectGroup(name.trim())` → 成功则把真实 group append 到 `groups`，清掉草稿；失败则 `message.error` 并保留草稿让用户重来。

### 6.4 重命名

- 默认分组（`is_default === true`）菜单项 `disabled`。
- 提交时如果 `trimmed === groups[i].name`：直接取消编辑态，不发请求。
- 否则 `updateProjectGroup(groupId, trimmed)` → 成功后更新 `groups` 对应项。

### 6.5 删除

- 默认分组菜单项 `disabled`。
- `Modal.confirm` 二次确认 → `deleteProjectGroup(groupId)`：
  - 成功：从 `groups` 移除；`groupMembership[groupId]` 里的 tasklist guid 全部回落到"根"（`groupMembership[groupId]` 删键即可）。
  - 失败：`message.error`。

### 6.6 拖拽排序

`onDrop` 里分两种节点：

- **分组节点**（key 前缀 `grp:`）：
  1. 算新 `sort_order = computeDropSortOrder(...)`。
  2. 校验：若会把 `is_default === true` 的分组挤出第 0 位，拒绝并 `return`。
  3. 乐观：本地立即 reorder + 写 sort_order。
  4. `updateGroupSortOrder(groupId, sortOrder)` → 失败则回滚并 `message.error`。
- **清单节点**（key 前缀 `tl:`）：走原有本地归属逻辑，不调后端。

### 6.7 名称校验

- 提交前 `trim()`。
- 长度必须 ≥ 1 且 ≤ 50，否则 `message.warning('分组名称需 1–50 个字符')` 并保持编辑态。

## 7. 错误处理

| 场景 | 行为 |
|------|------|
| 网络失败 / 非 success | `message.error(err.message)`；新建保留草稿，重命名保留编辑态，删除/排序回滚乐观更新 |
| 默认分组操作 | UI `disabled`，根本点不到；service 层不额外拦 |
| 名称超出长度 | 前端拦一道；同时兼容后端返回的 422 |

## 8. 并行实现拆分

- **Agent A — 基础设施**：
  - `config.yaml.example`、`config.yaml`、`.gitignore`
  - `src/vite-env.d.ts`、`src/config/appConfig.ts`、`src/services/request.ts`
- **Agent B — API 层**：
  - `src/types/projectGroup.ts`
  - `src/services/projectGroupService.ts`（含 `computeDropSortOrder`）
- **Agent C — Sidebar 接入**：
  - `src/components/Sidebar/index.tsx` 修改

A、B 并行；C 在 A、B 完成后启动（依赖它们导出的签名）。

## 9. 验收清单

- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] `config.yaml.example` 入库，`config.yaml` 未入库
- [ ] Sidebar 首次渲染可以看到后端返回的分组
- [ ] 新建分组：输名字 → POST 成功 → 列表出现真实 group_id
- [ ] 默认分组的"重命名"、"删除"菜单项 disabled
- [ ] 非默认分组改名 / 删除走真实接口并反映在 UI
- [ ] 分组拖拽排序走 PATCH，默认分组始终最顶
- [ ] 清单拖拽进/出分组**不**发网络请求（network 面板为证）

## 10. 风险

- `config.yaml` 里 `token` 会被 vite 打进 bundle，任何能访问前端资源的人都能看到。这是已知架构问题，不在本轮范围内修。
- 后端响应 schema 未正式给，`is_default` / `sort_order` 字段名可能与文档描述不一致。第一次联调以实际返回为准，`projectGroup.ts` 里统一适配。
- 刷新后"分组 → 本地清单"归属会丢，属已知取舍。
