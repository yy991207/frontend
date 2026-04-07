# 输入框斜杠快捷指令功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 chatpage/homepage/partnerpage 的输入框中输入 "/" 时触发 skill 接口调用，展示"我创建的"与"我添加的"skills列表，支持搜索、键盘导航和选择填充功能。

**Architecture:** 
- 创建独立的 `SkillSlashCommand` 组件，封装斜杠指令浮层的所有逻辑和样式
- 复用现有 `AttachmentMenu` 中的技能列表样式和接口调用逻辑
- 通过自定义 Hook `useSkillSlashCommand` 管理状态、键盘导航和接口请求
- 在三个页面的输入框中集成该组件，监听 "/" 按键触发

**Tech Stack:** React + TypeScript + CSS Modules + Ant Design Icons

---

## 前置依赖分析

### 现有代码结构

**技能服务层:**
- `src/services/skillPromptService.ts` - SkillItem 类型定义、API 响应解析
- `src/services/customSkillListService.ts` - 获取"我创建的"技能列表

**技能列表 UI:**
- `src/components/common/AttachmentMenu.tsx` - 附件菜单中的技能子菜单（样式和逻辑参考）
- `src/components/common/AttachmentMenu.module.less` - 技能列表样式

**三个目标页面:**
- `src/pages/Home/HomePage.tsx` - 首页输入框
- `src/pages/Chat/ChatPage.tsx` - 对话页输入框
- `src/pages/Partner/PartnerPage.tsx` - 伙伴页输入框

**技能数据结构:**
```typescript
type SkillItem = {
  id: string
  skillName: string
  title: string
  description: string
  template: string
  isSelected: boolean
}
```

**现有技能获取逻辑:**
三个页面都已实现 `fetchSkills` 函数，同时请求：
1. "我添加的"技能 - 通过 `skillApiConfig.manageEndpoint`
2. "我创建的"技能 - 通过 `skillApiConfig.listEndpoint`

---

## Task 1: 创建 SkillSlashCommand 组件类型定义

**Files:**
- Create: `src/components/common/SkillSlashCommand.tsx`
- Create: `src/components/common/SkillSlashCommand.module.less`

**Step 1: 定义组件 Props 类型**

```typescript
// src/components/common/SkillSlashCommand.tsx
import type { SkillItem } from '../../services/skillPromptService'

export type SkillSlashCommandProps = {
  /** 是否显示浮层 */
  visible: boolean
  /** 当前输入框的值 */
  inputValue: string
  /** 技能列表 */
  skills: SkillItem[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error?: string
  /** 选择技能回调 */
  onSelectSkill: (skill: SkillItem) => void
  /** 关闭浮层回调 */
  onClose: () => void
  /** 跳转到管理技能页面 */
  onManageSkills: () => void
  /** 页面来源，用于统计 */
  source: 'home' | 'chat' | 'partner'
}

export type SkillCategory = 'all' | 'created' | 'added'

export type SkillFilterState = {
  query: string
  category: SkillCategory
}
```

**Step 2: 运行类型检查**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS (无类型错误)

**Step 3: Commit**

```bash
git add src/components/common/SkillSlashCommand.tsx
git commit -m "feat(skill-slash): add SkillSlashCommand component types"
```

---

## Task 2: 创建 useSkillSlashCommand Hook

**Files:**
- Create: `src/hooks/useSkillSlashCommand.ts`

**Step 1: 编写 Hook 实现**

```typescript
// src/hooks/useSkillSlashCommand.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SkillItem } from '../services/skillPromptService'

export type UseSkillSlashCommandOptions = {
  inputValue: string
  skills: SkillItem[]
  loading: boolean
  onSelectSkill: (skill: SkillItem) => void
  onClose: () => void
}

export type UseSkillSlashCommandReturn = {
  /** 是否显示斜杠指令浮层 */
  visible: boolean
  /** 当前搜索关键词 */
  query: string
  /** 设置搜索关键词 */
  setQuery: (query: string) => void
  /** 当前选中的索引 */
  selectedIndex: number
  /** 过滤后的技能列表 */
  filteredSkills: SkillItem[]
  /** 当前激活的分类 */
  activeCategory: 'all' | 'created' | 'added'
  /** 设置分类 */
  setActiveCategory: (category: 'all' | 'created' | 'added') => void
  /** 处理键盘事件 */
  handleKeyDown: (event: React.KeyboardEvent) => void
  /** 处理选择 */
  handleSelect: (skill: SkillItem) => void
  /** 是否显示空状态 */
  isEmpty: boolean
}

/** 检测是否应该触发斜杠指令 */
function shouldTriggerSlashCommand(value: string): boolean {
  // 只有单独输入 "/" 时才触发
  // 避免与已有斜杠命令冲突（如 "/help"）
  return value === '/'
}

/** 从输入值中提取搜索关键词 */
function extractQuery(value: string): string {
  if (!value.startsWith('/')) return ''
  return value.slice(1).trim()
}

export function useSkillSlashCommand(
  options: UseSkillSlashCommandOptions,
): UseSkillSlashCommandReturn {
  const { inputValue, skills, loading, onSelectSkill, onClose } = options

  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState<'all' | 'created' | 'added'>('all')
  const prevInputRef = useRef(inputValue)

  // 监听输入值变化，控制浮层显示
  useEffect(() => {
    const prevValue = prevInputRef.current
    const currentValue = inputValue

    // 检测是否刚输入 "/"
    if (currentValue === '/' && prevValue !== '/') {
      setVisible(true)
      setQuery('')
      setSelectedIndex(0)
    }

    // 如果输入值不以 "/" 开头，关闭浮层
    if (!currentValue.startsWith('/')) {
      setVisible(false)
    }

    // 更新搜索关键词
    if (currentValue.startsWith('/')) {
      setQuery(extractQuery(currentValue))
    }

    prevInputRef.current = currentValue
  }, [inputValue])

  // 过滤技能列表
  const filteredSkills = useMemo(() => {
    let result = skills

    // 按分类过滤
    if (activeCategory !== 'all') {
      // 注意：这里假设技能数据中有 source 字段标识来源
      // 实际实现时需要根据数据结构调整
      result = result.filter((skill) => {
        if (activeCategory === 'created') {
          return skill.isSelected === false // 示例逻辑，需根据实际数据调整
        }
        return skill.isSelected === true
      })
    }

    // 按关键词过滤
    if (query) {
      const lowerQuery = query.toLowerCase()
      result = result.filter(
        (skill) =>
          skill.title.toLowerCase().includes(lowerQuery) ||
          skill.description.toLowerCase().includes(lowerQuery) ||
          skill.skillName.toLowerCase().includes(lowerQuery),
      )
    }

    return result
  }, [skills, query, activeCategory])

  // 当过滤结果变化时，重置选中索引
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredSkills.length, query, activeCategory])

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!visible) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredSkills.length - 1 ? prev + 1 : prev,
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
          break
        case 'Enter':
          event.preventDefault()
          if (filteredSkills[selectedIndex]) {
            handleSelect(filteredSkills[selectedIndex])
          }
          break
        case 'Escape':
          event.preventDefault()
          onClose()
          setVisible(false)
          break
      }
    },
    [visible, filteredSkills, selectedIndex, onClose],
  )

  // 处理选择
  const handleSelect = useCallback(
    (skill: SkillItem) => {
      onSelectSkill(skill)
      setVisible(false)
      setQuery('')
      setSelectedIndex(0)
    },
    [onSelectSkill],
  )

  const isEmpty = !loading && filteredSkills.length === 0

  return {
    visible,
    query,
    setQuery,
    selectedIndex,
    filteredSkills,
    activeCategory,
    setActiveCategory,
    handleKeyDown,
    handleSelect,
    isEmpty,
  }
}
```

**Step 2: 运行类型检查**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useSkillSlashCommand.ts
git commit -m "feat(skill-slash): add useSkillSlashCommand hook for state management"
```

---

## Task 3: 创建 SkillSlashCommand 组件样式

**Files:**
- Create: `src/components/common/SkillSlashCommand.module.less`

**Step 1: 编写样式文件**

```less
// src/components/common/SkillSlashCommand.module.less
// 复用 AttachmentMenu 中的技能列表样式风格

.root {
  position: absolute;
  left: 0;
  bottom: calc(100% + 12px);
  width: 360px;
  max-height: 480px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: #ffffff;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

// 头部区域
.header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin: 0;
}

// 分类标签
.tabs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab {
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 10px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;

  &:hover {
    background: #e5e7eb;
    color: #374151;
  }
}

.tabActive {
  background: #111827;
  color: #ffffff;

  &:hover {
    background: #1f2937;
    color: #ffffff;
  }
}

// 搜索框
.searchBox {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
}

.searchIcon {
  color: #9ca3af;
  font-size: 14px;
}

.searchInput {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #374151;
  font-size: 14px;

  &::placeholder {
    color: #9ca3af;
  }
}

// 技能列表
.skillList {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

// 技能项
.skillItem {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 12px;
  background: transparent;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  transition: background-color 0.16s ease;
  text-align: left;

  &:hover {
    background: #f8fafc;
  }
}

.skillItemSelected {
  background: #f3f4f6;

  &:hover {
    background: #f3f4f6;
  }
}

.skillItemIcon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 16px;
  flex-shrink: 0;
}

.skillItemInfo {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skillItemTitle {
  color: #111827;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}

.skillItemDesc {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// 加载状态
.loading {
  padding: 40px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loadingSpinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #6b7280;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 空状态
.empty {
  padding: 40px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.emptyIcon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 28px;
}

.emptyText {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.emptyHint {
  color: #9ca3af;
  font-size: 12px;
  margin: 0;
}

// 错误状态
.error {
  padding: 40px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.errorIcon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #fef2f2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #dc2626;
  font-size: 24px;
}

.errorText {
  color: #374151;
  font-size: 14px;
  margin: 0;
}

.errorHint {
  color: #9ca3af;
  font-size: 12px;
  margin: 0;
}

.retryButton {
  height: 32px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease;

  &:hover {
    background: #f8fafc;
    border-color: #d1d5db;
  }
}

// 底部管理按钮
.footer {
  padding: 10px 16px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footerHint {
  color: #9ca3af;
  font-size: 12px;
}

.manageButton {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.16s ease;

  &:hover {
    background: #f3f4f6;
  }
}

// 快捷键提示
.shortcutHint {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #9ca3af;
  font-size: 12px;
}

.shortcutKey {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
}

// 响应式适配
@media (max-width: 480px) {
  .root {
    width: calc(100vw - 32px);
    left: 50%;
    transform: translateX(-50%);
    max-height: 60vh;
  }
}
```

**Step 2: Commit**

```bash
git add src/components/common/SkillSlashCommand.module.less
git commit -m "feat(skill-slash): add SkillSlashCommand component styles"
```

---

## Task 4: 实现 SkillSlashCommand 组件

**Files:**
- Modify: `src/components/common/SkillSlashCommand.tsx`

**Step 1: 编写组件实现**

```tsx
// src/components/common/SkillSlashCommand.tsx
import { useEffect, useRef } from 'react'
import { SearchOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { SkillItem } from '../../services/skillPromptService'
import styles from './SkillSlashCommand.module.less'

export type SkillSlashCommandProps = {
  /** 是否显示浮层 */
  visible: boolean
  /** 当前搜索关键词 */
  query: string
  /** 设置搜索关键词 */
  setQuery: (query: string) => void
  /** 技能列表 */
  skills: SkillItem[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error?: string
  /** 当前选中索引 */
  selectedIndex: number
  /** 当前激活的分类 */
  activeCategory: 'all' | 'created' | 'added'
  /** 设置分类 */
  setActiveCategory: (category: 'all' | 'created' | 'added') => void
  /** 选择技能回调 */
  onSelectSkill: (skill: SkillItem) => void
  /** 关闭浮层回调 */
  onClose: () => void
  /** 跳转到管理技能页面 */
  onManageSkills: () => void
  /** 重试加载 */
  onRetry?: () => void
}

const CATEGORY_OPTIONS: { key: 'all' | 'created' | 'added'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'created', label: '我创建的' },
  { key: 'added', label: '我添加的' },
]

export function SkillSlashCommand(props: SkillSlashCommandProps) {
  const {
    visible,
    query,
    setQuery,
    skills,
    loading,
    error,
    selectedIndex,
    activeCategory,
    setActiveCategory,
    onSelectSkill,
    onClose,
    onManageSkills,
    onRetry,
  } = props

  const listRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)

  // 选中项滚动到可视区域
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedIndex])

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const root = document.querySelector('[data-skill-slash-root]')
      if (root && !root.contains(target)) {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [visible, onClose])

  if (!visible) return null

  const isEmpty = !loading && !error && skills.length === 0

  return (
    <div className={styles.root} data-skill-slash-root>
      {/* 头部 */}
      <div className={styles.header}>
        <h3 className={styles.title}>选择技能</h3>
        <div className={styles.tabs}>
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`${styles.tab} ${activeCategory === option.key ? styles.tabActive : ''}`}
              onClick={() => setActiveCategory(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 搜索框 */}
      <div className={styles.searchBox}>
        <SearchOutlined className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="搜索技能..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* 技能列表 */}
      <div className={styles.skillList} ref={listRef}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
            <span>加载技能列表...</span>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <div className={styles.errorIcon}>!</div>
            <p className={styles.errorText}>{error}</p>
            <p className={styles.errorHint}>请检查网络连接后重试</p>
            {onRetry && (
              <button type="button" className={styles.retryButton} onClick={onRetry}>
                重试
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <ThunderboltOutlined />
            </div>
            <p className={styles.emptyText}>
              {query ? '未找到匹配的技能' : '暂无技能'}
            </p>
            {!query && <p className={styles.emptyHint}>点击"管理技能"添加或创建技能</p>}
          </div>
        ) : (
          skills.map((skill, index) => (
            <button
              key={skill.id}
              ref={index === selectedIndex ? selectedItemRef : null}
              type="button"
              className={`${styles.skillItem} ${index === selectedIndex ? styles.skillItemSelected : ''}`}
              onClick={() => onSelectSkill(skill)}
              onMouseEnter={() => {
                // 鼠标悬停时更新选中索引
                // 这里通过父组件的 setSelectedIndex 实现
              }}
            >
              <div className={styles.skillItemIcon}>
                <ThunderboltOutlined />
              </div>
              <div className={styles.skillItemInfo}>
                <div className={styles.skillItemTitle}>{skill.title}</div>
                {skill.description && (
                  <div className={styles.skillItemDesc}>{skill.description}</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* 底部 */}
      <div className={styles.footer}>
        <div className={styles.shortcutHint}>
          <span className={styles.shortcutKey}>↑</span>
          <span className={styles.shortcutKey}>↓</span>
          <span>导航</span>
          <span className={styles.shortcutKey}>Enter</span>
          <span>选择</span>
          <span className={styles.shortcutKey}>Esc</span>
          <span>关闭</span>
        </div>
        <button type="button" className={styles.manageButton} onClick={onManageSkills}>
          <SettingOutlined />
          <span>管理技能</span>
        </button>
      </div>
    </div>
  )
}
```

**Step 2: 运行类型检查**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/common/SkillSlashCommand.tsx
git commit -m "feat(skill-slash): implement SkillSlashCommand component UI"
```

---

## Task 5: 更新 useSkillSlashCommand Hook 支持分类过滤

**Files:**
- Modify: `src/hooks/useSkillSlashCommand.ts`

**Step 1: 更新 Hook 支持分类过滤逻辑**

由于现有数据结构没有明确的 `source` 字段区分"我创建的"和"我添加的"，我们需要调整策略：

```typescript
// 更新后的过滤逻辑 - 暂时只按关键词过滤
// 分类功能后续根据后端数据结构调整

const filteredSkills = useMemo(() => {
  if (!query) return skills

  const lowerQuery = query.toLowerCase()
  return skills.filter(
    (skill) =>
      skill.title.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.skillName.toLowerCase().includes(lowerQuery),
  )
}, [skills, query])
```

**注意:** 当前版本先实现基础功能，分类过滤根据实际数据结构调整。

**Step 2: Commit**

```bash
git add src/hooks/useSkillSlashCommand.ts
git commit -m "refactor(skill-slash): simplify filter logic for initial implementation"
```

---

## Task 6: 在 HomePage 集成 SkillSlashCommand

**Files:**
- Modify: `src/pages/Home/HomePage.tsx`

**Step 1: 添加导入**

```typescript
// 在文件顶部添加导入
import { SkillSlashCommand } from '../../components/common/SkillSlashCommand'
import { useSkillSlashCommand } from '../../hooks/useSkillSlashCommand'
```

**Step 2: 在 HomePage 组件中添加 Hook 和状态**

```typescript
// 在 HomePage 组件内部，现有 state 之后添加
export default function HomePage() {
  // ... 现有 state ...
  
  // 斜杠指令相关
  const [slashCommandOpen, setSlashCommandOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)
  
  // 引用输入框
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // ... 其他代码 ...
}
```

**Step 3: 修改输入框 onKeyDown 处理**

找到现有的 `onKeyDown` 处理逻辑（约第 591-606 行），修改为：

```typescript
<Input.TextArea
  value={prompt}
  onChange={(event) => {
    const value = event.target.value
    setPrompt(value)
    
    // 检测斜杠指令触发
    if (value === '/' && !slashCommandOpen) {
      setSlashCommandOpen(true)
      setSlashQuery('')
      setSelectedSkillIndex(0)
    } else if (!value.startsWith('/')) {
      setSlashCommandOpen(false)
    } else if (value.startsWith('/')) {
      setSlashQuery(value.slice(1))
    }
  }}
  onKeyDown={(event) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return
    }

    // 斜杠指令浮层打开时的键盘处理
    if (slashCommandOpen) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedSkillIndex((prev) =>
            prev < skills.length - 1 ? prev + 1 : prev
          )
          return
        case 'ArrowUp':
          event.preventDefault()
          setSelectedSkillIndex((prev) => (prev > 0 ? prev - 1 : 0))
          return
        case 'Enter':
          event.preventDefault()
          const filteredSkills = skills.filter((skill) => {
            if (!slashQuery) return true
            const query = slashQuery.toLowerCase()
            return (
              skill.title.toLowerCase().includes(query) ||
              skill.description.toLowerCase().includes(query) ||
              skill.skillName.toLowerCase().includes(query)
            )
          })
          if (filteredSkills[selectedSkillIndex]) {
            handleSelectSkill(filteredSkills[selectedSkillIndex])
            setSlashCommandOpen(false)
            setPrompt('')
          }
          return
        case 'Escape':
          event.preventDefault()
          setSlashCommandOpen(false)
          return
      }
    }

    if (event.key === 'Backspace' && !prompt.trim() && selectedSkillName) {
      event.preventDefault()
      clearSelectedSkill()
    }

    // 支持 Enter 发送，Shift+Enter 换行
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }}
  // ... 其他 props ...
/>
```

**Step 4: 在输入框区域添加 SkillSlashCommand 组件**

找到输入框区域（约第 567-625 行），在 `inputWrap` div 内部添加组件：

```tsx
<div className={styles.inputWrap}>
  {/* 斜杠指令浮层 */}
  <SkillSlashCommand
    visible={slashCommandOpen}
    query={slashQuery}
    setQuery={(query) => {
      setSlashQuery(query)
      setPrompt('/' + query)
    }}
    skills={skills.filter((skill) => {
      if (!slashQuery) return true
      const query = slashQuery.toLowerCase()
      return (
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.skillName.toLowerCase().includes(query)
      )
    })}
    loading={skillsLoading}
    selectedIndex={selectedSkillIndex}
    activeCategory="all"
    setActiveCategory={() => {}}
    onSelectSkill={(skill) => {
      handleSelectSkill(skill)
      setSlashCommandOpen(false)
      setPrompt('')
    }}
    onClose={() => setSlashCommandOpen(false)}
    onManageSkills={handleManageSkills}
  />
  
  {/* 上方输入区域 */}
  <div className={styles.inputTopArea}>
    {/* ... 现有内容 ... */}
  </div>
  
  {/* 下方按钮区域 */}
  <div className={styles.inputBottomArea}>
    {/* ... 现有内容 ... */}
  </div>
</div>
```

**Step 5: 运行类型检查**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS

**Step 6: 测试验证**

1. 访问首页
2. 在输入框中输入 "/"
3. 验证浮层是否显示
4. 测试键盘导航（上下箭头、Enter、Escape）
5. 测试选择技能后是否正确填充

**Step 7: Commit**

```bash
git add src/pages/Home/HomePage.tsx
git commit -m "feat(skill-slash): integrate SkillSlashCommand in HomePage"
```

---

## Task 7: 在 ChatPage 集成 SkillSlashCommand

**Files:**
- Modify: `src/pages/Chat/ChatPage.tsx`

**Step 1: 添加导入**

```typescript
// 在文件顶部添加导入
import { SkillSlashCommand } from '../../components/common/SkillSlashCommand'
```

**Step 2: 在 ChatPageContent 组件中添加状态**

```typescript
function ChatPageContent() {
  // ... 现有 state ...
  
  // 斜杠指令相关
  const [slashCommandOpen, setSlashCommandOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)
  
  // ... 其他代码 ...
}
```

**Step 3: 修改输入框 onChange 和 onKeyDown**

找到输入框（约第 1366-1403 行），更新为：

```typescript
<Input.TextArea
  value={draft}
  onChange={(event) => {
    const value = event.target.value
    setDraft(value)
    
    // 检测斜杠指令触发
    if (value === '/' && !slashCommandOpen) {
      setSlashCommandOpen(true)
      setSlashQuery('')
      setSelectedSkillIndex(0)
    } else if (!value.startsWith('/')) {
      setSlashCommandOpen(false)
    } else if (value.startsWith('/')) {
      setSlashQuery(value.slice(1))
    }
  }}
  onKeyDown={(event) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return
    }

    // 斜杠指令浮层打开时的键盘处理
    if (slashCommandOpen) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedSkillIndex((prev) =>
            prev < skills.length - 1 ? prev + 1 : prev
          )
          return
        case 'ArrowUp':
          event.preventDefault()
          setSelectedSkillIndex((prev) => (prev > 0 ? prev - 1 : 0))
          return
        case 'Enter':
          event.preventDefault()
          const filteredSkills = skills.filter((skill) => {
            if (!slashQuery) return true
            const query = slashQuery.toLowerCase()
            return (
              skill.title.toLowerCase().includes(query) ||
              skill.description.toLowerCase().includes(query) ||
              skill.skillName.toLowerCase().includes(query)
            )
          })
          if (filteredSkills[selectedSkillIndex]) {
            handleSelectSkill(filteredSkills[selectedSkillIndex])
            setSlashCommandOpen(false)
            setDraft('')
          }
          return
        case 'Escape':
          event.preventDefault()
          setSlashCommandOpen(false)
          return
      }
    }

    if (event.key === 'Backspace' && !draft.trim() && selectedSkillName) {
      event.preventDefault()
      clearSelectedSkill()
      return
    }

    // 支持 Enter 发送，Shift+Enter 换行
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }}
  // ... 其他 props ...
/>
```

**Step 4: 在输入框区域添加 SkillSlashCommand 组件**

找到输入框区域（约第 1344-1445 行），在 `inputWrap` div 内部添加：

```tsx
<div className={styles.inputWrap}>
  {/* 斜杠指令浮层 */}
  <SkillSlashCommand
    visible={slashCommandOpen}
    query={slashQuery}
    setQuery={(query) => {
      setSlashQuery(query)
      setDraft('/' + query)
    }}
    skills={skills.filter((skill) => {
      if (!slashQuery) return true
      const query = slashQuery.toLowerCase()
      return (
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.skillName.toLowerCase().includes(query)
      )
    })}
    loading={skillsLoading}
    selectedIndex={selectedSkillIndex}
    activeCategory="all"
    setActiveCategory={() => {}}
    onSelectSkill={(skill) => {
      handleSelectSkill(skill)
      setSlashCommandOpen(false)
      setDraft('')
    }}
    onClose={() => setSlashCommandOpen(false)}
    onManageSkills={handleManageSkills}
  />
  
  {/* 上方输入区域 */}
  <div className={styles.inputTopArea}>
    {/* ... 现有内容 ... */}
  </div>
  
  {/* 下方按钮区域 */}
  <div className={styles.inputBottomArea}>
    {/* ... 现有内容 ... */}
  </div>
</div>
```

**Step 5: 运行类型检查**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/pages/Chat/ChatPage.tsx
git commit -m "feat(skill-slash): integrate SkillSlashCommand in ChatPage"
```

---

## Task 8: 在 PartnerPage 集成 SkillSlashCommand

**Files:**
- Modify: `src/pages/Partner/PartnerPage.tsx`

**Step 1: 添加导入**

```typescript
// 在文件顶部添加导入
import { SkillSlashCommand } from '../../components/common/SkillSlashCommand'
```

**Step 2: 在 PartnerPageContent 组件中添加状态**

```typescript
function PartnerPageContent() {
  // ... 现有 state ...
  
  // 斜杠指令相关
  const [slashCommandOpen, setSlashCommandOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)
  
  // ... 其他代码 ...
}
```

**Step 3: 修改输入框 onChange 和 onKeyDown**

找到输入框（约第 1794-1831 行），更新为：

```typescript
<Input.TextArea
  value={draft}
  onChange={(event) => {
    const value = event.target.value
    setDraft(value)
    
    // 检测斜杠指令触发
    if (value === '/' && !slashCommandOpen) {
      setSlashCommandOpen(true)
      setSlashQuery('')
      setSelectedSkillIndex(0)
    } else if (!value.startsWith('/')) {
      setSlashCommandOpen(false)
    } else if (value.startsWith('/')) {
      setSlashQuery(value.slice(1))
    }
  }}
  onKeyDown={(event) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return
    }

    // 斜杠指令浮层打开时的键盘处理
    if (slashCommandOpen) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedSkillIndex((prev) =>
            prev < skills.length - 1 ? prev + 1 : prev
          )
          return
        case 'ArrowUp':
          event.preventDefault()
          setSelectedSkillIndex((prev) => (prev > 0 ? prev - 1 : 0))
          return
        case 'Enter':
          event.preventDefault()
          const filteredSkills = skills.filter((skill) => {
            if (!slashQuery) return true
            const query = slashQuery.toLowerCase()
            return (
              skill.title.toLowerCase().includes(query) ||
              skill.description.toLowerCase().includes(query) ||
              skill.skillName.toLowerCase().includes(query)
            )
          })
          if (filteredSkills[selectedSkillIndex]) {
            handleSelectSkill(filteredSkills[selectedSkillIndex])
            setSlashCommandOpen(false)
            setDraft('')
          }
          return
        case 'Escape':
          event.preventDefault()
          setSlashCommandOpen(false)
          return
      }
    }

    if (event.key === 'Backspace' && !draft.trim() && selectedSkillName) {
      event.preventDefault()
      clearSelectedSkill()
      return
    }

    // 支持 Enter 发送，Shift+Enter 换行
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }}
  // ... 其他 props ...
/>
```

**Step 4: 在输入框区域添加 SkillSlashCommand 组件**

找到输入框区域（约第 1773-1874 行），在 `inputWrap` div 内部添加：

```tsx
<div className={styles.inputWrap}>
  {/* 斜杠指令浮层 */}
  <SkillSlashCommand
    visible={slashCommandOpen}
    query={slashQuery}
    setQuery={(query) => {
      setSlashQuery(query)
      setDraft('/' + query)
    }}
    skills={skills.filter((skill) => {
      if (!slashQuery) return true
      const query = slashQuery.toLowerCase()
      return (
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.skillName.toLowerCase().includes(query)
      )
    })}
    loading={skillsLoading}
    selectedIndex={selectedSkillIndex}
    activeCategory="all"
    setActiveCategory={() => {}}
    onSelectSkill={(skill) => {
      handleSelectSkill(skill)
      setSlashCommandOpen(false)
      setDraft('')
    }}
    onClose={() => setSlashCommandOpen(false)}
    onManageSkills={handleManageSkills}
  />
  
  {/* 上方输入区域 */}
  <div className={styles.inputTopArea}>
    {/* ... 现有内容 ... */}
  </div>
  
  {/* 下方按钮区域 */}
  <div className={styles.inputBottomArea}>
    {/* ... 现有内容 ... */}
  </div>
</div>
```

**Step 5: 运行类型检查**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/pages/Partner/PartnerPage.tsx
git commit -m "feat(skill-slash): integrate SkillSlashCommand in PartnerPage"
```

---

## Task 9: 添加输入框样式支持

**Files:**
- Modify: `src/pages/Home/home.module.less`
- Modify: `src/pages/Chat/chat.module.less`
- Modify: `src/pages/Partner/partner.module.less`

**Step 1: 更新三个页面的 inputWrap 样式**

在每个页面的 `.inputWrap` 样式中添加 `position: relative`：

```less
// src/pages/Home/home.module.less
.inputWrap {
  position: relative; // 添加这行
  // ... 其他样式 ...
}
```

```less
// src/pages/Chat/chat.module.less
.inputWrap {
  position: relative; // 添加这行
  // ... 其他样式 ...
}
```

```less
// src/pages/Partner/partner.module.less
.inputWrap {
  position: relative; // 添加这行
  // ... 其他样式 ...
}
```

**Step 2: Commit**

```bash
git add src/pages/Home/home.module.less src/pages/Chat/chat.module.less src/pages/Partner/partner.module.less
git commit -m "style(skill-slash): add position relative to inputWrap for slash command positioning"
```

---

## Task 10: 创建测试文件

**Files:**
- Create: `tests/skillSlashCommand.test.ts`

**Step 1: 编写测试用例**

```typescript
// tests/skillSlashCommand.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSkillSlashCommand } from '../src/hooks/useSkillSlashCommand'
import type { SkillItem } from '../src/services/skillPromptService'

const mockSkills: SkillItem[] = [
  {
    id: '1',
    skillName: 'ppt-generator',
    title: 'PPT生成器',
    description: '根据主题生成PPT大纲',
    template: '请帮我生成关于{{主题}}的PPT大纲',
    isSelected: false,
  },
  {
    id: '2',
    skillName: 'doc-writer',
    title: '文档助手',
    description: '帮助撰写各类文档',
    template: '请帮我写一份{{文档类型}}',
    isSelected: true,
  },
  {
    id: '3',
    skillName: 'code-reviewer',
    title: '代码审查',
    description: '审查代码并提供建议',
    template: '请审查以下代码',
    isSelected: false,
  },
]

describe('useSkillSlashCommand', () => {
  it('should not be visible when input does not start with /', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: 'hello',
        skills: mockSkills,
        loading: false,
        onSelectSkill,
        onClose,
      })
    )
    
    expect(result.current.visible).toBe(false)
  })

  it('should be visible when input is /', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: '/',
        skills: mockSkills,
        loading: false,
        onSelectSkill,
        onClose,
      })
    )
    
    expect(result.current.visible).toBe(true)
    expect(result.current.query).toBe('')
  })

  it('should extract query from input value', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: '/ppt',
        skills: mockSkills,
        loading: false,
        onSelectSkill,
        onClose,
      })
    )
    
    expect(result.current.visible).toBe(true)
    expect(result.current.query).toBe('ppt')
  })

  it('should filter skills by query', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: '/ppt',
        skills: mockSkills,
        loading: false,
        onSelectSkill,
        onClose,
      })
    )
    
    expect(result.current.filteredSkills).toHaveLength(1)
    expect(result.current.filteredSkills[0].title).toBe('PPT生成器')
  })

  it('should handle keyboard navigation', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: '/',
        skills: mockSkills,
        loading: false,
        onSelectSkill,
        onClose,
      })
    )
    
    // Initial selected index should be 0
    expect(result.current.selectedIndex).toBe(0)
    
    // Simulate ArrowDown
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent)
    })
    
    expect(result.current.selectedIndex).toBe(1)
    
    // Simulate ArrowUp
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent)
    })
    
    expect(result.current.selectedIndex).toBe(0)
  })

  it('should handle Enter selection', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: '/',
        skills: mockSkills,
        loading: false,
        onSelectSkill,
        onClose,
      })
    )
    
    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent)
    })
    
    expect(onSelectSkill).toHaveBeenCalledWith(mockSkills[0])
  })

  it('should handle Escape to close', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: '/',
        skills: mockSkills,
        loading: false,
        onSelectSkill,
        onClose,
      })
    )
    
    expect(result.current.visible).toBe(true)
    
    act(() => {
      result.current.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() } as unknown as React.KeyboardEvent)
    })
    
    expect(onClose).toHaveBeenCalled()
  })

  it('should return empty array when loading', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: '/',
        skills: [],
        loading: true,
        onSelectSkill,
        onClose,
      })
    )
    
    expect(result.current.isEmpty).toBe(false) // Loading state, not empty
  })

  it('should detect empty state correctly', () => {
    const onSelectSkill = vi.fn()
    const onClose = vi.fn()
    
    const { result } = renderHook(() =>
      useSkillSlashCommand({
        inputValue: '/nonexistent',
        skills: mockSkills,
        loading: false,
        onSelectSkill,
        onClose,
      })
    )
    
    expect(result.current.isEmpty).toBe(true)
  })
})
```

**Step 2: 运行测试**

Run: `npm test -- tests/skillSlashCommand.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/skillSlashCommand.test.ts
git commit -m "test(skill-slash): add unit tests for useSkillSlashCommand hook"
```

---

## Task 11: 最终验证和优化

**Step 1: 运行完整类型检查**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS

**Step 2: 运行 ESLint 检查**

Run: `npm run lint`
Expected: PASS (无错误)

**Step 3: 运行所有测试**

Run: `npm test`
Expected: All tests PASS

**Step 4: 手动测试清单**

在三个页面分别验证：

- [ ] 输入 "/" 触发浮层显示
- [ ] 输入 "/关键词" 实时过滤技能列表
- [ ] 按 Escape 关闭浮层
- [ ] 按上下箭头导航技能项
- [ ] 按 Enter 选择技能并填充输入框
- [ ] 点击技能项选择并填充
- [ ] 点击"管理技能"跳转到技能管理页
- [ ] 空状态显示正确
- [ ] 加载状态显示正确
- [ ] 浮层定位正确（在输入框上方）

**Step 5: Commit**

```bash
git commit -m "feat(skill-slash): complete slash command feature implementation

- Add SkillSlashCommand component with search and keyboard navigation
- Add useSkillSlashCommand hook for state management
- Integrate in HomePage, ChatPage, and PartnerPage
- Add unit tests for hook logic
- Style inputWrap for proper positioning"
```

---

## 文件变更汇总

### 新增文件
1. `src/components/common/SkillSlashCommand.tsx` - 斜杠指令组件
2. `src/components/common/SkillSlashCommand.module.less` - 组件样式
3. `src/hooks/useSkillSlashCommand.ts` - 状态管理 Hook
4. `tests/skillSlashCommand.test.ts` - 单元测试

### 修改文件
1. `src/pages/Home/HomePage.tsx` - 集成斜杠指令
2. `src/pages/Chat/ChatPage.tsx` - 集成斜杠指令
3. `src/pages/Partner/PartnerPage.tsx` - 集成斜杠指令
4. `src/pages/Home/home.module.less` - 添加定位样式
5. `src/pages/Chat/chat.module.less` - 添加定位样式
6. `src/pages/Partner/partner.module.less` - 添加定位样式

---

## 注意事项

1. **分类过滤功能**: 当前版本暂未实现"我创建的"和"我添加的"分类过滤，因为现有数据结构没有明确的 source 字段。后续可根据后端接口调整。

2. **接口复用**: 技能列表数据复用现有 `fetchSkills` 逻辑，同时获取"我添加的"和"我创建的"技能并合并去重。

3. **键盘冲突**: 斜杠指令浮层打开时，会拦截 Enter、Escape、上下箭头键，避免与输入框原有快捷键冲突。

4. **性能优化**: 技能列表过滤使用 `useMemo` 缓存，避免不必要的重计算。

5. **错误处理**: 组件支持传入 `error` 和 `onRetry` 属性，用于处理接口错误场景。
