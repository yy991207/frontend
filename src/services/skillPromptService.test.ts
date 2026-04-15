import { buildSkillInitialPrompt, buildSkillDisplayName, type SkillItem } from './skillPromptService'

describe('skillPromptService', () => {
  const mockSkill: Pick<SkillItem, 'skillName' | 'template' | 'title'> = {
    skillName: 'weather',
    template: '查询/地点天气',
    title: '天气查询',
  }

  describe('buildSkillDisplayName', () => {
    it('添加 / 前缀', () => {
      expect(buildSkillDisplayName('weather')).toBe('/weather')
    })

    it('去除已有的 / 前缀', () => {
      expect(buildSkillDisplayName('/weather')).toBe('/weather')
      expect(buildSkillDisplayName('//weather')).toBe('/weather')
    })

    it('空字符串返回空', () => {
      expect(buildSkillDisplayName('')).toBe('')
      expect(buildSkillDisplayName('  ')).toBe('')
    })
  })

  describe('buildSkillInitialPrompt', () => {
    it('skillName 和 template 都存在时，返回 基于 /skillName template', () => {
      expect(buildSkillInitialPrompt(mockSkill)).toBe('基于 /weather 查询/地点天气')
    })

    it('只有 template 时，返回 template', () => {
      expect(buildSkillInitialPrompt({ ...mockSkill, skillName: '' })).toBe('查询/地点天气')
    })

    it('只有 skillName 时，返回 skillName', () => {
      expect(buildSkillInitialPrompt({ ...mockSkill, template: '' })).toBe('/weather')
    })

    it('skillName 和 template 都没有时，返回 title', () => {
      expect(buildSkillInitialPrompt({ ...mockSkill, skillName: '', template: '' })).toBe('天气查询')
    })

    it('template 去除前后空白', () => {
      expect(buildSkillInitialPrompt({ ...mockSkill, template: '  查询/地点天气  ' })).toBe(
        '基于 /weather 查询/地点天气',
      )
    })

    it('title 去除前后空白', () => {
      expect(buildSkillInitialPrompt({ ...mockSkill, skillName: '', template: '', title: '  天气查询  ' })).toBe(
        '天气查询',
      )
    })
  })

  describe('防重复拼接', () => {
    it('当 template 已经是 buildSkillInitialPrompt 的输出时，不再次调用 buildSkillInitialPrompt 应保持不变', () => {
      const once = buildSkillInitialPrompt(mockSkill)
      // 模拟用户未修改直接发送的场景：draft 已经是 buildSkillInitialPrompt 的输出
      // handleSend 不应再次调用 buildSkillInitialPrompt，而应直接使用 draft
      const expectedOutgoing = once
      expect(expectedOutgoing).toBe('基于 /weather 查询/地点天气')
      // 如果错误地二次调用 buildSkillInitialPrompt，会产生：
      const wrongTwice = buildSkillInitialPrompt({
        skillName: 'weather',
        template: once,
        title: 'weather',
      })
      expect(wrongTwice).toBe('基于 /weather 基于 /weather 查询/地点天气')
      expect(wrongTwice).not.toBe(expectedOutgoing)
    })
  })
})
