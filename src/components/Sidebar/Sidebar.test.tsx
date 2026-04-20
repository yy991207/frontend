import '../../index.css'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar, { shouldUseCreateAsCurrent } from './Sidebar'
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
      <span>7 天内</span>
      <span>30 天内</span>
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
    agent_name: '产品和市场调研专家',
    avatar_url: '',
    used_at: '2026-04-14T10:00:00.000Z',
  },
]

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadCustomAgentApiConfig.mockResolvedValue(MOCK_AGENT_CONFIG)
    mockedGetAgentUsageLogs.mockResolvedValue(MOCK_AGENT_LIST)
  })

  it('默认展示当前展开侧边栏布局', async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(await screen.findByText('果仁')).toBeVisible()
    expect(screen.getByText('发现')).toBeVisible()
    expect(screen.getByText('你的智能伙伴')).toBeVisible()
    expect(screen.getByText('产品和市场调研专家')).toBeVisible()
    expect(screen.getByText('今天')).toBeVisible()
    expect(screen.getByText('7 天内')).toBeVisible()
    expect(screen.getByText('30 天内')).toBeVisible()
  })

  it('收起侧边栏时会把收起状态传给会话列表和智能体列表', async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(await screen.findByText('果仁')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '收起侧边栏' }))

    expect(screen.getByRole('button', { name: '展开侧边栏' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('session-history')).toHaveAttribute('data-expanded', 'false')
    expect(screen.getByTestId('sidebar-agent-list')).toHaveAttribute('data-sidebar-mode', 'collapsed')
  })

  it('新建按钮默认不应带常驻选中背景样式', async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(await screen.findByText('果仁')).toBeVisible()

    const createButton = screen.getByRole('button', { name: /新建/ })

    expect(createButton.className).not.toContain('homeRow')
  })

  it('当前智能体行应使用统一的选中背景样式', async () => {
    render(
      <MemoryRouter initialEntries={['/agent/agent-1/chat']}>
        <Sidebar />
      </MemoryRouter>,
    )

    const activeAgentName = await screen.findByText('产品和市场调研专家')
    const activeAgentRow = activeAgentName.closest('[aria-current="page"]')

    expect(activeAgentRow).not.toBeNull()
    expect(activeAgentRow?.className).toContain('sidebarItemActive')
  })

  it('进入带 sessionId 的智能体会话时，不应同时高亮智能体行', async () => {
    render(
      <MemoryRouter initialEntries={['/agent/agent-1/chat?sessionId=session-1']}>
        <Sidebar />
      </MemoryRouter>,
    )

    const agentName = await screen.findByText('产品和市场调研专家')
    const agentRow = agentName.closest('[aria-current="page"]')

    expect(agentRow).toBeNull()
  })

  it('指定根地址下应把新建按钮视为当前项', () => {
    expect(shouldUseCreateAsCurrent('/', 'http://192.168.61.219:5173/')).toBe(true)
    expect(shouldUseCreateAsCurrent('/', 'http://127.0.0.1:5173/')).toBe(false)
    expect(shouldUseCreateAsCurrent('/skills', 'http://192.168.61.219:5173/skills')).toBe(false)
  })

  it('当前导航项应保持白色背景和默认文字色', async () => {
    render(
      <MemoryRouter initialEntries={['/skills']}>
        <Sidebar />
      </MemoryRouter>,
    )

    const activeNavButton = await screen.findByRole('button', { name: /技能/ })

    expect(activeNavButton).toHaveAttribute('aria-current', 'page')
    expect(activeNavButton).toHaveStyle({
      backgroundColor: '#ffffff',
      color: '#1f2329',
    })
  })
})
