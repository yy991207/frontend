import { fireEvent, render, screen } from '@testing-library/react'
import { SkillSlashCommand } from './SkillSlashCommand'

const MOCK_SKILLS = [
  {
    id: 'skill-1',
    skillName: 'imagegen',
    title: 'AI 绘图',
    description: '根据你的描述快速生成图片和视觉草图',
    template: '帮我生成一张图片',
    isSelected: false,
  },
  {
    id: 'skill-2',
    skillName: 'ppt-maker',
    title: '生成 PPT',
    description: '自动整理结构并输出演示文稿大纲',
    template: '帮我生成一份演示文稿',
    isSelected: false,
  },
]

describe('SkillSlashCommand', () => {
  it('agentConversation 变体只展示技能内容列表，不显示标题和底部控制区', () => {
    render(
      <SkillSlashCommand
        visible
        variant="agentConversation"
        query=""
        setQuery={vi.fn()}
        skills={MOCK_SKILLS}
        loading={false}
        selectedIndex={0}
        onSelectSkill={vi.fn()}
        onClose={vi.fn()}
        onManageSkills={vi.fn()}
      />,
    )

    expect(screen.queryByText('选择技能')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('搜索技能...')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '管理技能' })).not.toBeInTheDocument()
    expect(screen.queryByText('导航')).not.toBeInTheDocument()
    expect(screen.getByText('根据你的描述快速生成图片和视觉草图')).toBeInTheDocument()
    expect(screen.getByText('AI 绘图')).toBeInTheDocument()
  })

  it('默认变体仍保留搜索和管理技能入口', () => {
    const onManageSkills = vi.fn()

    render(
      <SkillSlashCommand
        visible
        query="ai"
        setQuery={vi.fn()}
        skills={MOCK_SKILLS}
        loading={false}
        selectedIndex={0}
        onSelectSkill={vi.fn()}
        onClose={vi.fn()}
        onManageSkills={onManageSkills}
      />,
    )

    const manageButton = screen.getByRole('button', { name: /管理技能/i })

    expect(screen.getByText('选择技能')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索技能...')).toBeInTheDocument()

    fireEvent.click(manageButton)
    expect(onManageSkills).toHaveBeenCalledTimes(1)
  })
})
