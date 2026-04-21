import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DiscoverPage from './DiscoverPage'
import {
  loadCustomAgentApiConfig,
  listCustomAgents,
  listOfficialAgents,
  type CustomAgentApiConfig,
} from '../../services/customAgentService'

vi.mock('../../components/common/CreateAgentModal', () => ({
  default: () => null,
}))

vi.mock('../../services/customAgentService', async () => {
  const actual = await vi.importActual<typeof import('../../services/customAgentService')>('../../services/customAgentService')
  return {
    ...actual,
    loadCustomAgentApiConfig: vi.fn(),
    listCustomAgents: vi.fn(),
    listOfficialAgents: vi.fn(),
    getAgentUsageLogs: vi.fn().mockResolvedValue([]),
    addAgentUsageLog: vi.fn(),
  }
})

const mockedLoadCustomAgentApiConfig = vi.mocked(loadCustomAgentApiConfig)
const mockedListCustomAgents = vi.mocked(listCustomAgents)
const mockedListOfficialAgents = vi.mocked(listOfficialAgents)

const MOCK_CONFIG: CustomAgentApiConfig = {
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

describe('DiscoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadCustomAgentApiConfig.mockResolvedValue(MOCK_CONFIG)
    mockedListCustomAgents.mockResolvedValue([])
    mockedListOfficialAgents.mockResolvedValue([
      {
        agent_id: 'official-1',
        creator_user_id: 'guoren',
        agent_name: '测试',
        description: '测试描述',
        avatar_url: 'https://example.com/avatar.png',
        is_active: true,
        is_public: true,
        created_at: '2026-04-20T00:00:00Z',
        updated_at: '2026-04-20T00:00:00Z',
      },
    ])
  })

  it('企业精选遇到 example 占位头像时展示白底黑字默认头像', async () => {
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockedListOfficialAgents).toHaveBeenCalledWith(MOCK_CONFIG)
    })

    expect(screen.queryByAltText('测试')).not.toBeInTheDocument()
    expect(screen.getByText('测')).toHaveStyle({
      background: '#ffffff',
      color: '#1f2329',
    })
  })
})
