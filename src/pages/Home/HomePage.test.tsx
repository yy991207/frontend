import { useEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './HomePage'

vi.mock('../../components/common/AttachmentMenu', () => ({
  AttachmentMenu: () => <button type="button" data-testid="attachment-menu">附件菜单</button>,
}))

vi.mock('../../components/common/FileAttachmentPreview', () => ({
  FileAttachmentPreview: () => null,
}))

vi.mock('../../components/common/SkillSlashCommand', () => ({
  SkillSlashCommand: (props: { position?: string; variant?: string }) => {
    return <div data-testid="skill-slash-command" data-variant={props.variant ?? 'default'} data-position={props.position ?? 'above'} />
  },
}))

vi.mock('../../components/common/SkillTemplateInput', () => ({
  default: ({
    value,
    onChange,
    placeholder,
    onMultilineChange,
  }: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    onMultilineChange?: (isMultiline: boolean) => void
  }) => {
    useEffect(() => {
      onMultilineChange?.(value.includes('\n'))
    }, [onMultilineChange, value])

    return (
      <textarea
        aria-label="主页输入框"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  },
}))

describe('HomePage', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl = String(input)

      if (requestUrl.includes('home-tabs')) {
        return {
          ok: true,
          json: async () => ({
            tabs: [
              {
                key: 'best-practice',
                label: '最佳实践',
                contentType: 'practice-cards',
                items: [
                  {
                    id: 1,
                    coverClassName: 'practiceCoverSketch',
                    coverText: 'AlbertYang: 战略规划者 × 效率优化师',
                    title: '个人工作画像生成',
                    type: '图片',
                    views: '2,826',
                    uses: '55,656',
                  },
                ],
              },
            ],
          }),
        } as Response
      }

      if (requestUrl.includes('/api/v1/commands')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            code: '200',
            msg: 'success',
            data: {
              official_commands: [],
              best_practices: [
                {
                  id: 'bp_weekly_report',
                  type: 'practice',
                  name: '个人工作画像生成',
                  description: '生成个人工作画像',
                  template: '帮我生成工作画像',
                  skill_name: null,
                  attachments: [],
                  icon: null,
                  messages: [],
                  created_at: null,
                },
              ],
              my_commands: [],
            },
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          code: '0',
          msg: '',
          data: {
            items: [],
          },
        }),
      } as Response
    }) as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('首页展示飞书 aily 风格的欢迎区和快捷入口', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Hi 杨金玮，有什么可以帮你的？' })).toBeVisible()
    expect(screen.getByText('生成 PPT')).toBeVisible()
    expect(screen.getByText('搭建网页')).toBeVisible()
    expect(await screen.findByText('个人工作画像生成')).toBeVisible()
  })

  it('首页使用 agentConversation 变体输入区，展示附件按钮和联网开关，技能面板在下方弹出', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('home-composer')).toBeVisible()
    // agentConversation 变体：不再渲染附件菜单
    expect(screen.queryByTestId('attachment-menu')).not.toBeInTheDocument()
    // 技能面板使用下方定位
    expect(screen.getByTestId('skill-slash-command')).toHaveAttribute('data-variant', 'agentConversation')
    expect(screen.getByTestId('skill-slash-command')).toHaveAttribute('data-position', 'below')
  })

  it('输入斜杠时首页会抬高输入区层级，避免技能面板被下方页签遮挡', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const composerWrap = await screen.findByTestId('home-composer-wrap')
    const input = screen.getByLabelText('主页输入框')

    expect(composerWrap).toHaveAttribute('data-layer-state', 'normal')

    fireEvent.change(input, { target: { value: '/' } })

    await waitFor(() => {
      expect(composerWrap).toHaveAttribute('data-layer-state', 'raised')
      expect(global.fetch).toHaveBeenCalledTimes(4)
    })
  })

  it('多行内容时首页输入框会切换成上下分区布局', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/homepage',
            state: {
              initialPrompt: '第一行内容\n第二行内容',
            },
          },
        ]}
      >
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('home-composer')).toHaveAttribute('data-layout', 'stacked')
  })

  it('技能回填到首页时只保留输入框里的完整提示词，不再额外渲染前置 skill 标签', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/homepage',
            state: {
              initialPrompt: '基于 /ai-infographic 帮我制作一张关于 /主题 的信息图，类型是 /类型',
              skillName: 'ai-infographic',
              skillDescription: 'AI 信息图工具',
              template: '帮我制作一张关于 /主题 的信息图，类型是 /类型',
            },
          },
        ]}
      >
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByLabelText('主页输入框')).toHaveValue(
      '基于 /ai-infographic 帮我制作一张关于 /主题 的信息图，类型是 /类型',
    )
    expect(screen.queryByText('/ai-infographic')).not.toBeInTheDocument()
  })
})
