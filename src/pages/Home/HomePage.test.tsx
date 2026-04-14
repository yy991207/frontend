import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './HomePage'

vi.mock('../../components/common/AttachmentMenu', () => ({
  AttachmentMenu: () => <button type="button">附件菜单</button>,
}))

vi.mock('../../components/common/FileAttachmentPreview', () => ({
  FileAttachmentPreview: () => null,
}))

vi.mock('../../components/common/SkillSlashCommand', () => ({
  SkillSlashCommand: () => null,
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

  it('首页复用 chatpage 输入区后不再展示旧的语音按钮', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('home-composer')).toBeVisible()
    expect(screen.queryByRole('button', { name: '语音输入' })).not.toBeInTheDocument()
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
})
