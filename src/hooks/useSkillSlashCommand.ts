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
