import { fireEvent, render, screen } from '@testing-library/react'
import { AttachmentMenu, type AttachmentSkillItem } from './AttachmentMenu'

const MOCK_SKILLS: AttachmentSkillItem[] = [
  {
    id: 'skill-1',
    skillName: 'imagegen',
    title: '图片生成',
    description: '根据描述生成图片',
    template: '帮我生成一张图片',
    isSelected: false,
  },
]

describe('AttachmentMenu', () => {
  it('在工具和技能之间切换时复用同一个子菜单外壳', () => {
    const loadSkills = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <AttachmentMenu
        placement="top"
        skills={MOCK_SKILLS}
        skillsLoading={false}
        loadSkills={loadSkills}
        onSelectSkill={vi.fn()}
        onManageSkills={vi.fn()}
        showTools
      />,
    )

    const trigger = container.querySelector('button[aria-haspopup="menu"]')
    expect(trigger).not.toBeNull()

    fireEvent.click(trigger!)
    const toolButton = screen
      .getAllByText('工具')
      .map((node) => node.closest('button'))
      .find((button) => button?.textContent?.trim() === '工具')
    const skillButton = screen
      .getAllByText('技能')
      .map((node) => node.closest('button'))
      .find((button) => button?.textContent?.trim() === '技能')

    expect(toolButton).not.toBeNull()
    expect(skillButton).not.toBeNull()

    fireEvent.mouseEnter(toolButton!)

    const sharedSubmenu = screen.getByTestId('attachment-submenu-surface')
    expect(sharedSubmenu).toBeInTheDocument()
    expect(sharedSubmenu).toHaveTextContent('工具')
    expect(screen.getByText('互联网检索')).toBeInTheDocument()

    fireEvent.mouseEnter(skillButton!)

    expect(screen.getByTestId('attachment-submenu-surface')).toBe(sharedSubmenu)
    expect(sharedSubmenu).toHaveTextContent('技能')
    expect(screen.getByPlaceholderText('搜索技能')).toBeInTheDocument()
  })
})
