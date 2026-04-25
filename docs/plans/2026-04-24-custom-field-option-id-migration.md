# Custom Field Option Id Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把前端自定义字段选项从 `value` 切到 `id`，并接住任务展示态、动态文案、项目摘要的新返回格式。

**Architecture:** 先补一条最小回归脚本，卡住旧字段映射和缺失的新展示字段；再改服务层类型与任务映射；最后改任务表格和动态/历史展示，保证“写值”继续走原始 ID，“显示值”优先走后端新增的展示字段。

**Tech Stack:** React 19、TypeScript、Vite、Node 脚本回归检查

---

### Task 1: 补回归脚本

**Files:**
- Create: `scripts/check-custom-field-option-id-migration.mjs`

**Step 1: 写失败脚本**

检查以下约束：
- `customFieldService` 不再保留 `option.value`
- `TaskTable` 的字段定义映射改为读 `option.id`
- `taskService` 接住 `custom_fields_display`
- 动态和详情历史支持 `new_value_label`

**Step 2: 运行脚本确认失败**

Run: `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-custom-field-option-id-migration.mjs`

Expected: FAIL，提示仍存在旧字段或缺少新字段接入。

### Task 2: 修改服务层与类型

**Files:**
- Modify: `src/services/customFieldService.ts`
- Modify: `src/services/taskService.ts`
- Modify: `src/services/projectService.ts`
- Modify: `src/types/task.ts`

**Step 1: 更新选项与任务类型**

- 自定义字段选项接口改为 `id`
- 任务类型新增 `custom_fields_display`、`priority_option`
- 项目摘要接口改为数组项结构

**Step 2: 更新任务映射**

- `apiTaskToTask` 保留原始 `custom_fields`
- 同时把 `custom_fields_display`、`priority_option` 映射到前端任务对象

### Task 3: 修改展示层

**Files:**
- Modify: `src/components/TaskTable/index.tsx`
- Modify: `src/components/CustomFieldEditorModal/index.tsx`
- Modify: `src/components/CustomFieldsModal/index.tsx`
- Modify: `src/components/ActivityView/index.tsx`
- Modify: `src/components/TaskDetailPanel/index.tsx`

**Step 1: 字段编辑与字段定义改造**

- 自定义字段定义从 `option.id` 生成前端 `guid`
- 字段编辑弹窗本地草稿不再复用旧的 `value`

**Step 2: 任务展示值改造**

- select / multi_select 优先显示 `custom_fields_display`
- 本地乐观更新时同步刷新展示态，避免保存前后显示错位

**Step 3: 动态与历史改造**

- 优先显示 `payload.new_value_label / old_value_label`
- 增加 `task.priority_changed` 的明确展示

### Task 4: 验证与记录

**Files:**
- Create: `doc/工作记录 - 2026 年 0424.md`

**Step 1: 运行验证**

Run:
- `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-custom-field-option-id-migration.mjs`
- `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node scripts/check-custom-field-columns-use-raw-fields.mjs`
- `source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && npx eslint src/services/customFieldService.ts src/services/taskService.ts src/services/projectService.ts src/types/task.ts src/components/CustomFieldEditorModal/index.tsx src/components/CustomFieldsModal/index.tsx src/components/ActivityView/index.tsx src/components/TaskDetailPanel/index.tsx`

**Step 2: 记录结果**

- 在 `doc/工作记录 - 2026 年 0424.md` 记录背景、修改点、异常处理、影响范围、测试情况。
