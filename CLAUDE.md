# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# guoren-frontend 开发指南

本文件为 `guoren-frontend/` 前端目录的开发指南，所有代码修改均以本文件为准。

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19.x | 函数组件 + Hooks，严禁使用 Class 组件 |
| TypeScript | 5.9.x | 严格模式，所有组件和函数必须有类型注解 |
| Ant Design | 6.x | 主 UI 组件库 |
| grt-components | 1.5.x | 内部组件库 |
| React Router | 7.x | 客户端路由 |
| Vite | 8.x | 构建工具 |
| Less | 4.x | CSS 预处理器 |
| streamdown / remark / rehype | — | Markdown 渲染管线 |

## 常用命令

```bash
npm install           # 安装依赖
npm run dev           # 启动开发服务器 (http://0.0.0.0:5173)
npm run build         # 类型检查 + 生产构建 (tsc -b && vite build)
npm run lint          # ESLint 检查
npm run preview       # 预览构建产物
npm run test          # 运行 Vitest 单元测试
npx vitest run <path> # 运行指定测试文件
```

## 路由结构

路由定义在 `src/App.tsx`，整体为**左侧固定导航栏 + 右侧主内容区**的两栏布局。

| 路径 | 页面组件 | 说明 |
|------|----------|------|
| `/` | `HomePage` | 首页（deerflow 风格白底工作台） |
| `/chat` | `ChatPage` | 聊天页（流式消息、工具调用、右侧预览面板） |
| `/skills` | `SkillsPage` | 技能发现页 |
| `/library` | `LibraryPage` | 库（文件管理 + 预览） |
| `/discover` | `DiscoverPage` | 发现页 |
| `/partner` | `PartnerPage` | 智能伙伴管理页 |
| `/agent/:id` | `AgentDetailPage` | 智能伙伴详情 |
| `/agent/:id/chat` | `AgentConversationPage` | 智能伙伴对话页 |
| `/agent/create` | `AgentCreatePage` | 创建智能伙伴 |

## 目录结构

```
src/
  assets/                静态资源（图片、图标等）
  components/
    Sidebar/             左侧导航栏组件
    ChatSessionHistory/  会话历史列表
    chat/                聊天相关组件（消息列表、工具调用渲染、Markdown 内容、Artifact 展示等）
    common/              通用组件（附件菜单、技能 Slash 命令面板、各种 Modal 等）
    Partner/             智能伙伴相关组件（模型管理、工作区、技能管理）
  core/
    messages/            消息适配、流式处理、类型定义、消息分组
    artifacts/           课程表解析、Markdown 渲染、Artifact 加载器
    rehype/              rehype 插件配置
    streamdown/          streamdown 插件配置
    utils/               核心工具函数
  hooks/                 自定义 Hook（技能 Slash 命令、滚动等）
  pages/                 页面组件（与路由一一对应）
  services/              API 请求层（chat、skill、library、oss、partner 等）
  workers/               流式消息处理 Web Worker
  utils/                 通用工具函数
  test/                  Vitest 测试 setup
```

## 核心架构

### 流式聊天管线

聊天功能是整个前端的核心。数据流如下：

1. **`src/services/chatService.ts`** — 底层 HTTP/SSE 请求封装，负责与后端流式接口通信
2. **`src/services/chatStreamBridgeService.ts`** — 流式消息桥接服务，统一管理流的状态
3. **`src/services/chatStreamSnapshotStore.ts`** — 流快照持久化（sessionStorage），支持页面刷新后恢复
4. **`src/services/sharedChatRuntime.ts`** — 核心 React Hook（`useSharedChatRuntime`），封装所有聊天状态和逻辑，被 ChatPage、AgentConversationPage 等复用
5. **`src/workers/chatStreamWorker.ts`** — Web Worker，在后台线程处理流式消息，避免阻塞 UI
6. **`src/core/messages/`** — 消息类型定义、适配器、流式更新逻辑、消息分组

### 消息类型体系

- `Message` / `LegacyChatMessage` — 单条消息（`core/messages/types.ts`）
- `MessageGroup` — 消息分组（human / assistant:processing / assistant:reasoning / assistant:subagent 等）
- `ToolCall` — 工具调用记录（名称、状态、输入/输出）
- `CourseItem` / `SkillOutputItem` — 结构化输出项

### Markdown 渲染管线

基于 `streamdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-raw`，支持 GFM 表格、数学公式、KaTeX 渲染。插件配置在 `src/core/streamdown/plugins.ts`。

### 配置来源

前端从 `/config.yaml` 读取运行时配置（API 地址、会话参数等），通过 `src/services/chatSessionService.ts` 解析。

## 开发规范

### 组件
- 所有组件使用**函数组件 + TypeScript**，Props 必须定义 interface
- 文件名与组件名保持一致（PascalCase）
- 单个组件文件不超过 300 行，超出时拆分子组件

### 样式
- 优先使用 Ant Design 组件，不重复造轮子
- 自定义样式使用 Less（`.less` 文件），避免全局类名污染
- 主题色、间距等设计 token 通过 `antd` ConfigProvider 统一配置

### API 层
- 所有请求统一放在 `src/services/` 下，按模块分文件
- 请求函数必须有入参和返回值的类型定义

### 命名约定
- 组件文件：`PascalCase.tsx`
- 工具/服务文件：`camelCase.ts`
- 类型文件：`camelCase.types.ts` 或集中在 `types/` 目录

## 测试

- 测试框架：Vitest + jsdom + @testing-library/react
- 测试文件位于 `tests/` 目录
- 运行单个测试：`npx vitest run tests/文件名.test.tsx`

## 后端接口

后端服务基于 FastAPI 项目（默认 `http://localhost:8000`），接口地址通过 `/config.yaml` 配置。

## 注意事项

- 本目录下的 CLAUDE.md **优先于**根目录 CLAUDE.md 中的前端相关说明
- 修改前必须先读取对应文件，不得凭猜测修改
- 涉及多组件改动时，须梳理调用链后再动手
- 设计参考图存放在 `doc/images/` 目录下，开发时以这些截图为视觉基准
