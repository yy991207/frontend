# Task Table Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成任务列表页“筛选”模块，支持多条件且逻辑、系统字段和自定义字段按类型展示不同条件和值控件。

**Architecture:** 以 `TaskTable` 为唯一筛选状态源，新增结构化筛选条件模型，工具栏 Popover 负责编辑条件，任务列表在现有 `tasksAfterFilter` 里统一做串行匹配。系统字段和自定义字段共用同一套渲染与计算入口，但按字段类型分配不同的二级条件和值输入组件。

**Tech Stack:** React 19、TypeScript、Ant Design 6、dayjs、现有 `.mjs` 文本回归测试

---

### Task 1: 补筛选模块失败回归测试

**Files:**
- Modify: `tests/task-table-toolbar-regression.test.mjs`
- Create: `tests/task-table-filter-regression.test.mjs`
- Test: `tests/task-table-toolbar-regression.test.mjs`
- Test: `tests/task-table-filter-regression.test.mjs`

**Step 1: Write the failing test**

- 给 `task-table-toolbar-regression` 增加对新筛选面板结构的断言：
  - 不允许继续只保留两个 Checkbox。
  - 需要存在条件数组状态、添加条件按钮、清空按钮、默认且逻辑提示。
- 新增 `task-table-filter-regression`：
  - 一级分类要包含负责人、开始时间、截止时间、完成时间、分配人、关注人、创建人以及自定义字段。
  - 一级分类不应包含“任务来源”和“来源类别”。
  - 日期类字段二级条件要有“等于/早于/晚于/介于/为空/不为空”。
  - 人员/单选/多选/文本类字段二级条件要有“包含/不包含/为空/不为空”。
  - 数值类字段二级条件要有“等于/不等于/小于/小于等于/大于/大于等于/为空/不为空”。
  - 多条件默认使用“且”。
  - 自定义字段值下拉要走字段 options，人员值下拉要走用户列表。

**Step 2: Run test to verify it fails**

Run:
```bash
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-toolbar-regression.test.mjs
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-filter-regression.test.mjs
```

Expected: FAIL，提示缺少筛选条件模型和字段类型映射。

**Step 3: Write minimal implementation**

- 暂不写生产代码，这一步只提交测试文件。

**Step 4: Run test to verify it passes**

- 本任务不应通过，继续进入下一任务。

**Step 5: Commit**

```bash
git add tests/task-table-toolbar-regression.test.mjs tests/task-table-filter-regression.test.mjs
git commit -m "test: add task table filter regressions"
```

### Task 2: 定义筛选条件模型与字段类型映射

**Files:**
- Modify: `src/components/TaskTable/index.tsx`
- Test: `tests/task-table-filter-regression.test.mjs`

**Step 1: Write the failing test**

- 复用 Task 1 的失败测试，不新加测试。

**Step 2: Run test to verify it fails**

Run:
```bash
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-filter-regression.test.mjs
```

Expected: FAIL，提示缺少字段配置与条件定义。

**Step 3: Write minimal implementation**

- 在 `TaskTable` 里新增：
  - 系统筛选字段 key、类型、标签定义。
  - 自定义字段转筛选字段的映射函数。
  - 条件类型枚举和日期快捷项定义。
  - 筛选条件结构体，例如字段 key、operator、value、extraValue。
- 明确排除 `taskSource` 和 `sourceCategory`。
- 给日期、人员、文本、选择、数值这几类字段分配不同 operator 列表。

**Step 4: Run test to verify it passes**

Run:
```bash
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-filter-regression.test.mjs
```

Expected: 部分通过，UI 相关断言可能仍失败。

**Step 5: Commit**

```bash
git add src/components/TaskTable/index.tsx tests/task-table-filter-regression.test.mjs
git commit -m "feat: add task table filter field definitions"
```

### Task 3: 实现筛选面板 UI

**Files:**
- Modify: `src/components/TaskTable/index.tsx`
- Modify: `src/components/TaskTable/index.less`
- Test: `tests/task-table-toolbar-regression.test.mjs`
- Test: `tests/task-table-filter-regression.test.mjs`

**Step 1: Write the failing test**

- 继续使用前面测试，不新增。

**Step 2: Run test to verify it fails**

Run:
```bash
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-toolbar-regression.test.mjs
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-filter-regression.test.mjs
```

Expected: FAIL，提示 still 使用 Checkbox 或缺少条件行结构。

**Step 3: Write minimal implementation**

- 把 `filterPanel` 从简单 Checkbox 改成：
  - 标题区 + 清空入口。
  - 条件行列表。
  - 添加条件按钮。
  - 条件行包含：
    - 第一行显示“当”，后续显示“且”。
    - 一级字段选择。
    - 二级条件选择。
    - 第三段值输入，根据字段类型动态切换。
    - 删除当前条件按钮。
- 用 AntD `Select`、`DatePicker`、`Input`、`UserSearchSelect` 组合值输入。
- 自定义字段如果是单选/多选，展示全部 option。
- 日期类先支持“指定日期”与相对日期选项。

**Step 4: Run test to verify it passes**

Run:
```bash
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-toolbar-regression.test.mjs
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-filter-regression.test.mjs
```

Expected: UI 结构断言通过，过滤计算断言可能仍失败。

**Step 5: Commit**

```bash
git add src/components/TaskTable/index.tsx src/components/TaskTable/index.less tests/task-table-toolbar-regression.test.mjs tests/task-table-filter-regression.test.mjs
git commit -m "feat: build task table filter panel"
```

### Task 4: 接入真实过滤计算与工具栏计数

**Files:**
- Modify: `src/components/TaskTable/index.tsx`
- Test: `tests/task-table-filter-regression.test.mjs`

**Step 1: Write the failing test**

- 让 `task-table-filter-regression` 约束：
  - `tasksAfterFilter` 要调用统一筛选匹配函数。
  - 条件数组按 every 逻辑计算。
  - 不同字段类型读取对应 task 数据。
  - `activeFilterCount` 改成条件数量。

**Step 2: Run test to verify it fails**

Run:
```bash
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-filter-regression.test.mjs
```

Expected: FAIL，提示当前仍是旧过滤逻辑。

**Step 3: Write minimal implementation**

- 实现：
  - 系统字段值提取器。
  - 自定义字段值提取器。
  - operator 匹配函数。
  - 日期类 relative 选项到真实日期区间的判断。
  - `tasksAfterFilter` 改成在原状态过滤后再走 `every(condition => matchTaskFilterCondition(...))`。
- `activeFilterCount` 改为当前有效条件数。

**Step 4: Run test to verify it passes**

Run:
```bash
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-filter-regression.test.mjs
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/TaskTable/index.tsx tests/task-table-filter-regression.test.mjs
git commit -m "feat: apply task table filter logic"
```

### Task 5: 完整验证与文档更新

**Files:**
- Modify: `doc/工作记录 - 2026 年 0422.md`
- Test: `tests/task-table-toolbar-regression.test.mjs`
- Test: `tests/task-table-filter-regression.test.mjs`
- Test: `npm run build`

**Step 1: Write the failing test**

- 无新测试。

**Step 2: Run test to verify it fails**

- 无。

**Step 3: Write minimal implementation**

- 补工作记录：
  - 改动背景
  - 字段类型映射
  - 条件模型
  - 异常处理
  - 影响范围
  - 测试情况

**Step 4: Run test to verify it passes**

Run:
```bash
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-toolbar-regression.test.mjs
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && node tests/task-table-filter-regression.test.mjs
source $(conda info --base)/etc/profile.d/conda.sh && conda activate deepagent && npm run build
```

Expected: 全部通过

**Step 5: Commit**

```bash
git add doc/工作记录\ -\ 2026\ 年\ 0422.md src/components/TaskTable/index.tsx src/components/TaskTable/index.less tests/task-table-toolbar-regression.test.mjs tests/task-table-filter-regression.test.mjs
git commit -m "feat: complete task table filters"
```
