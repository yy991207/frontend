# Chat Rendering Deerflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前聊天页的渲染链路改成接近 deerflow 的结构，支持消息分组、富 Markdown、工具态区块和后续 reasoning/subagent 扩展。

**Architecture:** 保留现有 `ChatPage` 里的会话创建、SSE 流消费和发送交互，只把“消息如何组织和如何显示”抽到独立核心模块与组件里，避免把当前页面继续做成大文件。渲染层走 `streamdown + remark/rehype`，样式继续用 Less，不引入 Tailwind，保证迁移范围只落在聊天模块。

**Tech Stack:** React 19、TypeScript、LESS、`node:test`、streamdown、remark-gfm、remark-math、rehype-katex、rehype-raw、unist-util-visit

---

### Task 1: 消息模型与分组工具

**Files:**
- Create: `src/core/messages/types.ts`
- Create: `src/core/messages/utils.ts`
- Create: `src/core/messages/adapters.ts`
- Test: `tests/chatMessageGrouping.test.ts`

**Step 1: Write the failing test**

覆盖这些行为：
- 当前 `ChatPage` 的消息结构可以被转换成统一消息模型
- 用户消息单独成组
- 只有工具调用的 assistant 消息会落到 `assistant:processing`
- 有正文的 assistant 消息会落到 `assistant`
- 引用、课程和 reasoning 占位信息能在适配阶段保留下来

**Step 2: Run test to verify it fails**

Run: `node --test tests/chatMessageGrouping.test.ts`

**Step 3: Write minimal implementation**

实现：
- deerflow 风格 `Message` / `MessageGroup` 类型
- `groupMessages`
- 文本提取、内容判断、工具调用判断
- 当前 `ChatMessage -> Message` 的适配函数

**Step 4: Run test to verify it passes**

Run: `node --test tests/chatMessageGrouping.test.ts`

### Task 2: Markdown 渲染管线

**Files:**
- Create: `src/core/rehype/index.ts`
- Create: `src/core/streamdown/plugins.ts`
- Create: `src/components/chat/markdown-content.tsx`
- Test: `tests/chatMarkdownPipeline.test.ts`

**Step 1: Write the failing test**

覆盖这些点：
- 插件配置里启用了 GFM、数学公式和 KaTeX
- 自定义 rehype 插件会保留结构并对文本节点做逐词动画包装
- `markdown-content.tsx` 使用了 `Streamdown`
- 组件启用了流式模式和 deerflow 风格插件配置

**Step 2: Run test to verify it fails**

Run: `node --test tests/chatMarkdownPipeline.test.ts`

**Step 3: Write minimal implementation**

实现：
- `rehypeSplitWordsIntoSpans`
- 标准插件配置和流式动画插件配置
- `MarkdownContent` 组件
- KaTeX 样式引入

**Step 4: Run test to verify it passes**

Run: `node --test tests/chatMarkdownPipeline.test.ts`

### Task 3: 聊天渲染组件

**Files:**
- Create: `src/components/chat/message-list.tsx`
- Create: `src/components/chat/message-group.tsx`
- Modify: `src/pages/Chat/ChatPage.tsx`
- Modify: `src/pages/Chat/chat.module.less`
- Test: `tests/chatDeerflowRendering.test.ts`

**Step 1: Write the failing test**

覆盖这些点：
- `ChatPage` 不再直接依赖旧的 `renderMessageMarkdown`
- 聊天页改为通过消息列表组件渲染
- assistant 区域支持消息分组
- 工具卡、课程卡、引用区块仍然保留
- reasoning/subagent 占位渲染入口已预留

**Step 2: Run test to verify it fails**

Run: `node --test tests/chatDeerflowRendering.test.ts`

**Step 3: Write minimal implementation**

实现：
- 消息列表组件
- 分组组件
- 处理中的工具调用区块
- assistant Markdown 正文渲染
- 课程推荐和引用区块迁移
- `ChatPage` 接线改成把原始消息先适配、分组，再交给组件渲染

**Step 4: Run test to verify it passes**

Run: `node --test tests/chatDeerflowRendering.test.ts`

### Task 4: 依赖、记录与总验证

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create or Modify: `doc/工作记录 - 2026 年 0403.md`

**Step 1: Install minimal dependencies**

安装：
- `streamdown`
- `remark-gfm`
- `remark-math`
- `rehype-katex`
- `rehype-raw`
- `katex`
- `unist-util-visit`
- `@types/hast`

**Step 2: Write structured change record**

记录：
- 改动背景
- 主要修改点
- 异常处理与兼容处理
- 涉及模块
- 影响范围
- 测试情况

**Step 3: Final verification**

Run:
- `node --test tests/chatMessageGrouping.test.ts tests/chatMarkdownPipeline.test.ts tests/chatDeerflowRendering.test.ts`
- `npm run build`
