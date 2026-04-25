# Task Table Inline Create Style Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把任务列表分组下的“新建任务”入口和行内新建态改成参考图里的大方框样式，同时保留现有创建逻辑和分组行为。

**Architecture:** 继续沿用 `TaskTable` 现有的 `newTask` 行和 `inlineCreate` 行数据结构，不新开第二套渲染链路。主要通过收敛新建入口结构、抽统一的大方框字段容器、改写行内创建样式三步完成，确保影响面只留在 `TaskTable` 组件内部。

**Tech Stack:** React 19、TypeScript、Ant Design 6、Less、Node 源码回归脚本

---

### Task 1: 固定失败约束

**Files:**
- Create: `scripts/check-task-table-inline-create-style.mjs`
- Test: `scripts/check-task-table-inline-create-style.mjs`

**Step 1: Write the failing test**

写一个源码级回归脚本，覆盖这些约束：
- 分组下“新建任务”入口必须有独立的大块容器，而不是直接渲染纯文本按钮
- 行内新建标题输入框必须包在独立的大方框容器里
- 行内日期触发器必须使用大方框样式类
- 行内通用字段容器必须支持统一的大方框外观

**Step 2: Run test to verify it fails**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-task-table-inline-create-style.mjs`

Expected: FAIL，指出当前 `new-task-btn`、`inline-title-input`、`date-trigger` 仍是轻量样式。

**Step 3: Commit**

先不提交，进入实现。

### Task 2: 调整新建入口和行内创建结构

**Files:**
- Modify: `src/components/TaskTable/index.tsx`
- Test: `scripts/check-task-table-inline-create-style.mjs`

**Step 1: Write minimal implementation**

在 `TaskTable` 里做最小结构调整：
- 把 `newTask` 行从纯 `Button` 改成带文案容器的整行点击结构
- 给标题、优先级、负责人、开始时间、截止时间这些行内创建字段补统一的盒子包裹层
- 不改创建接口和已有状态字段，只改渲染结构

**Step 2: Run test to verify progress**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-task-table-inline-create-style.mjs`

Expected: 如果还有失败，应该只剩样式类未补齐，不再是结构缺失。

### Task 3: 调整 Less 样式复刻视觉

**Files:**
- Modify: `src/components/TaskTable/index.less`
- Test: `scripts/check-task-table-inline-create-style.mjs`

**Step 1: Write minimal implementation**

补齐视觉样式：
- `new-task` 行 hover 态和留白做成参考图那种整块浅灰底
- `inlineCreate` 行做成整行浅蓝底，字段本身是白底大方框
- 标题输入框、日期触发器、下拉类字段统一边框、圆角、高度、阴影和 hover/focus

**Step 2: Run test to verify it passes**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-task-table-inline-create-style.mjs`

Expected: PASS

### Task 4: 回归验证

**Files:**
- Modify: `src/components/TaskTable/index.tsx`
- Modify: `src/components/TaskTable/index.less`
- Test: `scripts/check-task-table-inline-create-style.mjs`
- Test: `scripts/check-date-panel-month-switch.mjs`
- Test: `scripts/check-task-row-detail-click.mjs`

**Step 1: Run targeted regression**

Run:
- `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-task-table-inline-create-style.mjs`
- `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-date-panel-month-switch.mjs`
- `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-task-row-detail-click.mjs`

Expected: PASS

**Step 2: Run build**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && npm run build`

Expected: PASS

### Task 5: 补文档

**Files:**
- Modify: `doc/工作记录 - 2026 年 0424.md`

**Step 1: Record**

补充改动背景、根因、实现方案、影响范围、测试命令和结果。
