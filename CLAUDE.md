# guoren-frontend CLAUDE.md

本文件为 `guoren-frontend/` 前端目录的开发指南，所有关于该前端的代码修改均以本文件为准。

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 18.x | 函数组件 + Hooks，严禁使用 Class 组件 |
| TypeScript | 5.x | 严格模式，所有组件和函数必须有类型注解 |
| Ant Design | 5.x | 主 UI 组件库 |
| React Router | 6.x | 客户端路由 |
| Vite | 5.x | 构建工具 |
| CSS Modules / less | — | 样式方案，antd 主题通过 ConfigProvider 定制 |

## 页面结构（参考设计图）

整体为**左侧固定导航栏 + 右侧主内容区**的两栏布局。

### 左侧导航栏（Sidebar）
- 顶部：应用 Logo + 用户名（飞书 aily 风格）
- 导航菜单项：新建、库、技能、发现、开发应用
- 智能伙伴区：当前用户绑定的 AI 伙伴头像 + 名称
- 历史记录区："7 天内" 分组，列出最近会话
- 底部：用户头像 + 用户名 + 历史/设置图标

### 主页（Home）
- 中央欢迎区：AI 头像 + 问候语（"Hi {用户名}，有什么可以帮你的?"）
- 输入框：左侧 "+" 附件按钮，右侧语音 + 发送按钮，支持 `/` 触发技能下拉
- 快捷指令标签行：横向滚动，含生成PPT、写报告、搭建网页等
- 底部内容区：最佳实践 / 推荐指令 / 我的指令 三个 Tab，Tab 内容为卡片网格

### 技能页（Skills）
- 顶部标题 + "创建" 下拉按钮 + "管理技能" 按钮
- 搜索框
- Banner 轮播（官方推荐技能包 / 直播预告）
- "官方精选" 卡片网格（可换一换），每张卡片：彩色图标、名称、标签、描述、使用次数

### 技能管理页（Skill Management）
- 返回按钮 + 页面标题"管理技能" + 搜索框 + "+ 创建" 按钮
- Tab 切换：我添加的 / 我创建的
- 2 列卡片网格，每张卡片：
  - 彩色图标 + 名称 + "内置" Badge + "..." 更多菜单
  - 描述文本
  - "立即使用" 按钮
  - "..." 菜单含：自动调用（Toggle）、移除

### "/" 技能快速调用面板
- 在输入框输入 `/` 时弹出 Dropdown
- 列表项：彩色图标 + 技能名 + 标签组 + 描述
- 底部固定"管理技能"入口

## 目录结构

```
guoren-frontend/
├── public/
├── src/
│   ├── assets/          # 图片、图标等静态资源
│   ├── components/      # 公共组件
│   │   ├── Layout/      # Sidebar、AppLayout
│   │   └── common/      # Button、Card 等通用封装
│   ├── pages/           # 页面组件（与路由一一对应）
│   │   ├── Home/        # 主页
│   │   ├── Skills/      # 技能发现页
│   │   ├── SkillManage/ # 技能管理页
│   │   ├── Library/     # 库
│   │   └── Discover/    # 发现
│   ├── hooks/           # 自定义 Hook
│   ├── services/        # API 请求层（fetch/axios 封装）
│   ├── store/           # 全局状态（Zustand 或 Context）
│   ├── types/           # 全局 TypeScript 类型定义
│   ├── utils/           # 工具函数
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 开发规范

### 组件
- 所有组件使用**函数组件 + TypeScript**，Props 必须定义 interface
- 文件名与组件名保持一致（PascalCase）
- 单个组件文件不超过 300 行，超出时拆分子组件

### 样式
- 优先使用 Ant Design 组件，不重复造轮子
- 自定义样式使用 CSS Modules（`xxx.module.less`），避免全局类名污染
- 主题色、间距等设计 token 通过 `antd` ConfigProvider 统一配置，不硬编码颜色值

### 状态管理
- 组件内部状态用 `useState` / `useReducer`
- 跨页面/全局状态用 Zustand 或 React Context
- 服务端数据缓存用 SWR 或 React Query（后续按需引入）

### API 层
- 所有请求统一放在 `src/services/` 下，按模块分文件（`skillService.ts`、`chatService.ts` 等）
- 请求函数必须有入参和返回值的类型定义
- 后端接口基准地址通过环境变量 `VITE_API_BASE_URL` 配置

### 命名约定
- 组件文件：`PascalCase.tsx`
- 工具/服务文件：`camelCase.ts`
- CSS Module：`camelCase.module.less`
- 类型文件：`camelCase.types.ts` 或集中在 `types/` 目录

## 后端接口

后端服务基于本仓库根目录的 FastAPI 项目（默认 `http://localhost:8000`）。

关键接口（与前端相关）：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/chat/sessions/{id}/stream` | SSE 流式聊天 |
| GET  | `/api/v1/chat/sessions/{id}/files` | 列出会话生成的文件 |
| GET  | `/api/v1/chat/sessions/{id}/files/download` | 下载/预览文件 |
| POST | `/api/v1/questions` | 随机提问（首页快捷指令数据源） |

SSE 事件类型参考根目录 `CLAUDE.md` 的"SSE 流式事件"章节。

## Quick Start（待项目初始化后更新）

```bash
cd guoren-frontend
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

## 注意事项

- 本目录下的 CLAUDE.md **优先于**根目录 CLAUDE.md 中的前端相关说明
- 修改前必须先读取对应文件，不得凭猜测修改
- 涉及多组件改动时，须梳理调用链后再动手
- 设计参考图存放在本目录下的 `*.png` 文件中，开发时以这些截图为视觉基准
