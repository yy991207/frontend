import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './Sidebar'
import {
  getAgentUsageLogs,
  loadCustomAgentApiConfig,
  type AgentUsageLogItem,
  type CustomAgentApiConfig,
} from '../../services/customAgentService'

vi.mock('../ChatSessionHistory/ChatSessionHistory', () => ({
  default: ({ expanded }: { expanded: boolean }) => (
    <div data-testid="session-history" data-expanded={expanded ? 'true' : 'false'}>
      <span>今天</span>
    </div>
  ),
}))

vi.mock('../../services/customAgentService', async () => {
  const actual = await vi.importActual<typeof import('../../services/customAgentService')>('../../services/customAgentService')
  return {
    ...actual,
    loadCustomAgentApiConfig: vi.fn(),
    getAgentUsageLogs: vi.fn(),
    deleteAgentUsageLog: vi.fn(),
  }
})

const mockedLoadCustomAgentApiConfig = vi.mocked(loadCustomAgentApiConfig)
const mockedGetAgentUsageLogs = vi.mocked(getAgentUsageLogs)

const MOCK_AGENT_CONFIG: CustomAgentApiConfig = {
  userId: '123456',
  baseUrl: 'http://localhost:8000',
  createAgentEndpoint: 'http://localhost:8000/create',
  listAgentEndpoint: 'http://localhost:8000/list',
  viewAgentEndpoint: 'http://localhost:8000/view/{agent_id}',
  updateAgentEndpoint: 'http://localhost:8000/update/{agent_id}',
  chatAgentEndpoint: 'http://localhost:8000/chat/{agent_id}',
  generateAgentTemplateEndpoint: 'http://localhost:8000/generate',
  getAgentTemplateTaskEndpoint: 'http://localhost:8000/tasks/{task_id}',
  agentTemplatesEndpoint: 'http://localhost:8000/templates',
  agentTemplateDetailEndpoint: 'http://localhost:8000/template/{template_id}',
  agentUsageLogsEndpoint: 'http://localhost:8000/logs',
}

const MOCK_AGENT_LIST: AgentUsageLogItem[] = [
  {
    agent_id: 'agent-1',
    user_id: '123456',
    agent_name: '测试智能体',
    avatar_url: '',
    used_at: '2026-04-14T10:00:00.000Z',
  },
]

describe('Sidebar collapsed layout spacing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadCustomAgentApiConfig.mockResolvedValue(MOCK_AGENT_CONFIG)
    mockedGetAgentUsageLogs.mockResolvedValue(MOCK_AGENT_LIST)
  })

  it('收起时侧边栏宽度应等于图标宽度 + 左右内边距，无多余空白', async () => {
    // 图标宽度 36px + 左边距 12px + 右边距 8px = 56px
    const expectedCollapsedWidth = 56

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    // 等待渲染完成
    expect(await screen.findByText('果仁')).toBeVisible()

    // 点击收起按钮
    const collapseButton = screen.getByRole('button', { name: '收起侧边栏' })
    fireEvent.click(collapseButton)

    // 获取侧栏元素
    const sidebar = document.querySelector('aside')!

    // 验证收起状态（CSS module 会哈希类名，用宽度判断）
    const computedStyle = window.getComputedStyle(sidebar)
    const actualWidth = parseInt(computedStyle.width, 10)

    // 关键断言：收起时宽度不应超过 56px（图标 36 + 左 12 + 右 8）
    // 如果宽度 > 56，说明有多余空白
    expect(actualWidth).toBeLessThanOrEqual(expectedCollapsedWidth)
  })

  it('展开时侧边栏宽度应为 280px', async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(await screen.findByText('果仁')).toBeVisible()

    const sidebar = document.querySelector('aside')!
    const computedStyle = window.getComputedStyle(sidebar)
    const actualWidth = parseInt(computedStyle.width, 10)

    // 展开时宽度应为 280px
    expect(actualWidth).toBe(280)
  })

  it('收起后再展开，宽度应恢复 280px', async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(await screen.findByText('果仁')).toBeVisible()

    const sidebar = document.querySelector('aside')!

    // 收起
    fireEvent.click(screen.getByRole('button', { name: '收起侧边栏' }))
    expect(screen.getByRole('button', { name: '展开侧边栏' })).toBeVisible()

    // 展开
    fireEvent.click(screen.getByRole('button', { name: '展开侧边栏' }))
    expect(screen.getByRole('button', { name: '收起侧边栏' })).toBeVisible()

    const computedStyle = window.getComputedStyle(sidebar)
    const actualWidth = parseInt(computedStyle.width, 10)
    expect(actualWidth).toBe(280)
  })
})
