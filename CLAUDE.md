# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19.x | 函数组件 + Hooks，严禁使用 Class 组件 |
| TypeScript | 5.9.x | 严格模式，所有组件和函数必须有类型注解 |
| Ant Design | 6.x | 主 UI 组件库（通过 `antd/es/*` 子路径按需引入，以便 Vite manualChunks 生效） |
| React Router | 7.x | 客户端路由 |
| Vite | 8.x | 构建工具 |
| Less | 4.x | CSS 预处理器（`javascriptEnabled: true`） |
| dayjs | — | 全局 locale 已在 `src/main.tsx` 切到 `zh-cn` |

## 常用命令

```bash
npm run dev      # 启动 Vite 开发服务器
npm run build    # tsc -b 类型检查 + vite build
npm run lint     # ESLint（配置见 eslint.config.js）
npm run preview  # 预览生产构建

# 单独运行某个一致性/回归检查脚本（scripts/ 下均为可直接 node 执行的 .mjs）
node scripts/check-dayjs-locale.mjs
```

`scripts/` 目录里是一组针对特定 UI/行为回归点的静态检查脚本（如 assignee picker、date panel、sidebar collapse、deprecated antd props 等）。新增相关功能时若破坏了约束，这些脚本会失败；修 bug 时也可新增对应脚本来锁住行为。

## 运行时配置

- 根目录 `config.yaml`（参考 `config.yaml.example`）是运行时配置，字段：`url`、`user_id`、`team_id`、`token`。
- 配置通过 `src/config/appConfig.ts` 以 `?raw` 方式在构建期被 Vite 内联并用一个极简 YAML 解析器解析——**不要引入 `js-yaml` 等依赖，也不要把 config.yaml 提交到仓库**（已在 .gitignore）。
- 所有后端请求由 `src/services/request.ts` 封装：基于 `fetch`，自动拼接 `appConfig.url`、注入 `Authorization: Bearer <token>`，并按 `ApiResponse<T> = { success, code, msg, data }` 规范解包，失败时 throw `Error(msg)`。

## 架构总览

单页应用，入口极简：`src/main.tsx` → `src/App.tsx`（只做 antd `ConfigProvider` + `zh_CN` locale 包裹）→ `src/pages/TaskList.tsx`（当前唯一页面）。

核心分层：

- **`src/pages/`** — 页面级组合。目前只有 `TaskList`，它组合 Sidebar + TaskTable + TaskDetailPanel 构成主工作区。
- **`src/components/`** — 功能组件，按业务聚合为目录：`Sidebar`、`TaskTable`、`TaskDetailPanel`、`InlineTaskCreator`、`EditableInput`、`ActivityView`、`PlaceholderView`。
- **`src/services/`** — 业务 API 封装，一份 service 对应一个领域：`taskService`、`projectService`、`projectGroupService`、`sectionService`、`teamService`，全部基于 `request.ts`。
- **`src/types/`** — 领域类型：`task`、`project`、`projectGroup`。services 的参数与返回值都应使用这里的类型。
- **`src/config/`** — `appConfig`（运行时）与 `viewConfig`（视图/字段可见性等前端配置）。
- **`src/mock/api.ts`** — 本地 mock 数据，用于无后端时开发。

路径别名：`@/*` → `src/*`（`vite.config.ts` 与 `tsconfig.app.json` 双向配置）。

## 领域概念（来自 `doc/`）

业务围绕"任务中心"展开，关键概念：**团队(team) → 项目组(projectGroup / 清单) → 项目(project / section) → 任务(task) → 子任务**，并带有负责人(assignee)、日期、活动流(Activity) 等。动手改数据流/UI 前，`doc/01-任务功能整体解析.md` 到 `doc/05-清单管理与搜索筛选.md` 是理解约束的权威来源；新增功能尽量沿用已有的 service + type 分层，不要把业务请求直接写进组件。

## Vite 打包约束

`vite.config.ts` 的 `manualChunks` 非常细地把 antd / @rc-component / react / dayjs 拆成多个 vendor chunk（`antd-base` / `antd-controls` / `antd-display` / `antd-feedback` / `antd-form` / `antd-layout` / `antd-misc` / `antd-icons` / `antd-style` 等）以规避入口 chunk 过大的告警。**新增 antd 组件时请使用 `antd/es/<component>` 子路径引入**，不要直接 `import { Xxx } from 'antd'`，否则分包策略会失效、构建体积告警会复发。
