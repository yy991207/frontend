# Skill Upload Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 给技能页补上“上传技能”弹窗，支持本地选择文件和拖拽上传，调用后端上传接口，并在成功后展示技能基础信息。

**Architecture:** 保持页面主入口还在 `SkillsPage`，避免大范围拆分；把上传配置解析、接口调用和结果提取下沉到独立 service，方便用 `node:test` 先写失败用例再接页面状态。弹窗继续走现有自绘样式方案，不额外引入上传库，保证和设计图一致。

**Tech Stack:** React 19、TypeScript、LESS、原生 `fetch`、`node:test`

---

### Task 1: 上传服务

**Files:**
- Create: `src/services/skillUploadService.ts`
- Test: `tests/skillUploadService.test.ts`

**Step 1: Write the failing test**

覆盖三件事：
- 能从 `config.yaml` 读出 `user_id`、`skill_user_id_param`、`upload_skill_path`
- 会按 query 参数拼出上传地址
- 会用 `FormData` 把用户文件发给后端，并把失败 `msg` 和成功数据透传出来

**Step 2: Run test to verify it fails**

Run: `node --test tests/skillUploadService.test.ts`

**Step 3: Write minimal implementation**

实现：
- `parseSkillUploadApiConfig`
- `uploadCustomSkill`
- 成功结果里的 `skill_id`、`skill_name`、`description` 提取

**Step 4: Run test to verify it passes**

Run: `node --test tests/skillUploadService.test.ts`

### Task 2: 技能页弹窗交互

**Files:**
- Modify: `src/pages/Skills/SkillsPage.tsx`
- Test: `tests/skillUploadModal.test.ts`

**Step 1: Write the failing test**

覆盖源码层面的关键点：
- “上传技能”菜单项有点击处理
- 页面里存在上传弹窗、文件选择入口、拖拽状态
- 成功后会渲染 `skill_name` 和 `description`
- 顶部会展示上传失败 `msg`

**Step 2: Run test to verify it fails**

Run: `node --test tests/skillUploadModal.test.ts`

**Step 3: Write minimal implementation**

实现：
- 创建菜单点击“上传技能”时打开弹窗
- 支持选择文件和拖拽文件
- 上传中、失败提示、成功信息回填
- “完成”按钮关闭弹窗并清空状态

**Step 4: Run test to verify it passes**

Run: `node --test tests/skillUploadModal.test.ts`

### Task 3: 样式细节

**Files:**
- Modify: `src/pages/Skills/skills.module.less`

**Step 1: Write minimal implementation**

补齐：
- 遮罩层
- 白色弹窗
- 虚线拖拽区域
- 顶部提示条
- 成功信息表单布局

关键细节：
- 按效果图控制圆角、边框、阴影和间距
- 不用紫色渐变
- 保证桌面和窄屏都能正常显示

**Step 2: Run verification**

Run: `npm run build`

### Task 4: 文档

**Files:**
- Create or Modify: `doc/工作记录 - 2026 年 0402.md`

**Step 1: Write structured change record**

记录：
- 改动背景
- 主要修改点
- 异常处理方式
- 影响范围
- 测试情况

**Step 2: Final verification**

Run:
- `node --test tests/skillUploadService.test.ts tests/skillUploadModal.test.ts`
- `npm run build`
