# 评论区图片粘贴与预览 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让任务详情评论区支持粘贴图片上传，并在输入区和已发送评论里直接预览图片。

**Architecture:** 复用现有评论附件上传链路，把图片粘贴产生的 `File` 直接走 `uploadAttachment(..., { ownerType: 'comment' })`。预览层新增一个轻量图片附件组件：图片类附件直接内联显示缩略图，点击时再按参考实现通过接口取预览 URL/内容展示；非图片附件继续走现有文件卡片。为了避免扩大范围，这次把预览能力先收在 `TaskDetailPanel` 内部，不新建全局面板状态管理。

**Tech Stack:** React 19、TypeScript、Ant Design、现有 `attachmentService` / `commentService`、本地 `file-preview` 样式与 hook。

---

### Task 1: 锁住评论区图片交互回归

**Files:**
- Modify: `tests/request-and-file-preview-regression.test.mjs`
- Modify: `tests/task-detail-subtask-blur-regression.test.mjs`
- Add: `tests/comment-image-preview-regression.test.mjs`

**Step 1: Write the failing test**

给评论区补源码断言，至少覆盖：
- 评论输入区存在 `onPaste` 处理。
- 粘贴图片会复用 `handleCommentAttachmentUpload`。
- 评论附件渲染会判断图片类型并走预览组件，而不是一律文件卡片。
- 预览取图走接口辅助函数，不直接只靠本地 `blob:`。

**Step 2: Run test to verify it fails**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs`
Expected: FAIL，因为当前评论区还没有粘贴图片和图片预览。

**Step 3: Write minimal implementation**

先不动大量 UI，只补必要断言对应的代码骨架。

**Step 4: Run test to verify it passes**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs`
Expected: PASS

### Task 2: 补附件预览辅助能力

**Files:**
- Modify: `src/services/attachmentService.ts`
- Add: `src/components/file-preview/file-preview-renderer.tsx`

**Step 1: Write the failing test**

断言需要有：
- 图片类型判断辅助函数或等价逻辑。
- 附件预览 URL 构造函数或预览内容加载函数。
- 共享图片预览渲染组件支持 `imageUrl` + loading。

**Step 2: Run test to verify it fails**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs`
Expected: FAIL

**Step 3: Write minimal implementation**

- 在 `attachmentService.ts` 里补：
  - `isImageAttachment(att)`
  - `buildAttachmentPreviewUrl(attachmentId)`，先复用下载接口 `mode=inline` 思路输出 URL
- 把参考页里的 `FilePreviewRenderer` 精简移植到当前仓库，支持图片、代码、空态和 loading。

**Step 4: Run test to verify it passes**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs`
Expected: PASS

### Task 3: 评论输入区接入图片粘贴上传

**Files:**
- Modify: `src/components/TaskDetailPanel/index.tsx`
- Modify: `src/components/TaskDetailPanel/index.less`

**Step 1: Write the failing test**

断言：
- 评论输入组件从简单 `Input` 改成能处理多行和粘贴事件的输入形式。
- 有 `handleCommentPaste` 或等价逻辑。
- 从 `clipboardData.items` 里提取 image file 后走 `handleCommentAttachmentUpload`。

**Step 2: Run test to verify it fails**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs`
Expected: FAIL

**Step 3: Write minimal implementation**

- 评论输入区改为 `Input.TextArea`
- 加 `onPaste`
- 发现图片后 `preventDefault`
- 调现有上传函数
- 关键处理写中文注释，说明这里复用评论附件上传链路

**Step 4: Run test to verify it passes**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs`
Expected: PASS

### Task 4: 评论区内联预览图片

**Files:**
- Modify: `src/components/TaskDetailPanel/index.tsx`
- Modify: `src/components/TaskDetailPanel/index.less`

**Step 1: Write the failing test**

断言：
- 待发送评论附件和已发送评论附件都要区分图片 / 非图片。
- 图片附件渲染预览块，不再只显示扩展名文件卡片。
- 点击图片会打开预览。

**Step 2: Run test to verify it fails**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs`
Expected: FAIL

**Step 3: Write minimal implementation**

- 新增评论图片附件小卡片
- 输入区直接显示缩略图
- 已发送评论同样直接显示缩略图
- 非图片继续保持原附件卡片

**Step 4: Run test to verify it passes**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs`
Expected: PASS

### Task 5: 图片预览弹层与接口调用

**Files:**
- Modify: `src/components/TaskDetailPanel/index.tsx`
- Modify: `src/components/TaskDetailPanel/index.less`
- Possibly modify: `src/components/file-preview/use-file-content.ts`

**Step 1: Write the failing test**

断言：
- 打开图片预览时会走预览 URL / 内容加载函数。
- 预览关闭时 loading 会清空。
- 预览组件使用共享 `FilePreviewRenderer`。

**Step 2: Run test to verify it fails**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs && node tests/request-and-file-preview-regression.test.mjs`
Expected: FAIL

**Step 3: Write minimal implementation**

- 在详情面板内部维护当前预览附件状态
- 点击图片附件时打开预览弹层 / 覆盖层
- 用共享预览组件渲染图片
- 预览 URL 走 `buildAttachmentPreviewUrl`

**Step 4: Run test to verify it passes**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs && node tests/request-and-file-preview-regression.test.mjs`
Expected: PASS

### Task 6: 全量验证与文档

**Files:**
- Modify: `doc/工作记录 - 2026 年 0421.md`

**Step 1: Run focused tests**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/comment-image-preview-regression.test.mjs && node tests/request-and-file-preview-regression.test.mjs && node tests/task-row-actions-regression.test.mjs && node tests/subtask-indent-layout-regression.test.mjs`

**Step 2: Run build**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && npm run build`

**Step 3: Update work log**

把本次评论区图片粘贴与预览接入写进 `doc/工作记录 - 2026 年 0421.md`。
