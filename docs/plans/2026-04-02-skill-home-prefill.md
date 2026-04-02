# 技能使用跳转首页预填模板 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让技能管理页和技能发现页点击“使用”后，基于接口返回的 `skill_name + template` 预填首页输入框，并保留对应 `toolType`。

**Architecture:** 抽一层共享技能工具，统一解析接口里的 `template` 字段并生成首页预填文案。技能页只负责跳转并透传预填状态，首页负责消费状态、展示输入框内容，并在发送时优先使用技能指定的 `toolType`。

**Tech Stack:** React 19、TypeScript、react-router-dom、Node `node:test`

---

### Task 1: 先写失败测试

**Files:**
- Create: `tests/skillPromptService.test.ts`
- Modify: `tests/manageSkillsNavigation.test.ts`

**Step 1: 写技能预填文案的失败测试**

```ts
test('buildSkillInitialPrompt combines slash skill name with template', () => {
  assert.equal(
    buildSkillInitialPrompt({
      skillName: 'explore',
      template: '帮我规划一个关于 /主题 的课表，要求 /数量 门课程，总时长 /总时长 分钟',
      title: '课程探索',
    }),
    '/explore 帮我规划一个关于 /主题 的课表，要求 /数量 门课程，总时长 /总时长 分钟',
  )
})
```

**Step 2: 跑测试确认先失败**

Run: `node --test tests/skillPromptService.test.ts tests/manageSkillsNavigation.test.ts`
Expected: FAIL，提示缺少 `skillPromptService` 或源码里还没有跳首页逻辑

### Task 2: 实现共享技能工具

**Files:**
- Create: `src/services/skillPromptService.ts`
- Modify: `src/components/common/AttachmentMenu.tsx`

**Step 1: 新增技能数据和模板工具**

```ts
export type SkillItem = {
  id: string
  skillName: string
  title: string
  description: string
  template: string
  isSelected: boolean
}
```

**Step 2: 实现模板拼装**

```ts
export function buildSkillInitialPrompt(skill: Pick<SkillItem, 'skillName' | 'template' | 'title'>) {
  // 优先保留 skill_name，首页输入框里直接展示技能调用模板。
}
```

### Task 3: 接入技能页和首页

**Files:**
- Modify: `src/pages/Skills/SkillsPage.tsx`
- Modify: `src/pages/Home/HomePage.tsx`

**Step 1: 技能页“使用”跳首页**

```ts
navigate('/', {
  state: {
    initialPrompt: buildSkillInitialPrompt(skill),
    toolType: skill.skillName || skill.id,
  },
})
```

**Step 2: 首页消费预填状态**

```ts
useEffect(() => {
  if (!routeState?.initialPrompt) return
  setPrompt(routeState.initialPrompt)
  setPendingToolType(routeState.toolType ?? null)
}, [routeState])
```

**Step 3: 首页发送时优先使用技能 toolType**

```ts
toolType: pendingToolType || resolveQuickActionToolType(value)
```

### Task 4: 运行验证

**Files:**
- Verify: `tests/skillPromptService.test.ts`
- Verify: `tests/manageSkillsNavigation.test.ts`

**Step 1: 跑相关测试**

Run: `node --test tests/skillPromptService.test.ts tests/manageSkillsNavigation.test.ts`
Expected: PASS

**Step 2: 跑构建检查**

Run: `conda activate deepagent && npm run build`
Expected: BUILD SUCCESS

### Task 5: 补工作记录

**Files:**
- Create: `doc/工作记录 - 2026 年 0402.md`

**Step 1: 记录改动背景、实现方式、异常处理、影响范围和测试结果**

```md
- 改动背景
- 主要修改点
- 异常处理
- 涉及模块
- 影响范围
- 测试情况
```
