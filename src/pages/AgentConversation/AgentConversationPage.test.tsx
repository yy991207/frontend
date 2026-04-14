import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AgentConversationPage from './AgentConversationPage'
import {
  loadCustomAgentApiConfig,
  viewCustomAgent,
  type AgentDetail,
  type CustomAgentApiConfig,
} from '../../services/customAgentService'
import { parseChatApiConfig } from '../../services/chatService'
import { useSharedChatRuntime } from '../../services/sharedChatRuntime'

const { mockedAttachmentMenu } = vi.hoisted(() => ({
  mockedAttachmentMenu: vi.fn(),
}))

const { mockedMessageInfo } = vi.hoisted(() => ({
  mockedMessageInfo: vi.fn(),
}))

vi.mock('antd', () => ({
  message: {
    info: mockedMessageInfo,
    warning: vi.fn(),
  },
}))

vi.mock('../../components/chat/artifact-file-detail', () => ({
  ArtifactFileDetail: () => null,
}))

vi.mock('../../components/chat/message-list', () => ({
  MessageList: () => <div data-testid="message-list" />,
}))

vi.mock('../../components/chat/artifacts-context', () => ({
  ArtifactsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useArtifacts: () => ({
    addFile: vi.fn(),
    selectFile: vi.fn(),
    open: false,
    selectedFile: null,
  }),
}))

vi.mock('../../components/common/AttachmentMenu', () => ({
  AttachmentMenu: (props: { showTools?: boolean }) => {
    mockedAttachmentMenu(props)
    return <div data-testid="attachment-menu" data-show-tools={String(Boolean(props.showTools))} />
  },
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
    onKeyDown,
  }: {
    value: string
    onChange: (value: string) => void
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>
  }) => (
    <textarea
      aria-label="聊天输入框"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  ),
}))

vi.mock('../../services/ossUploadService', () => ({
  createPendingUploadedFile: vi.fn(),
  isAllowedFileType: vi.fn(() => true),
  ALLOWED_FILE_EXTENSIONS: ['txt'],
}))

vi.mock('../../services/agentFileUploadService', () => ({
  uploadPendingFileToOssWithDocumentParse: vi.fn(),
}))

vi.mock('../../services/customAgentService', async () => {
  const actual = await vi.importActual<typeof import('../../services/customAgentService')>('../../services/customAgentService')
  return {
    ...actual,
    loadCustomAgentApiConfig: vi.fn(),
    viewCustomAgent: vi.fn(),
  }
})

vi.mock('../../services/chatService', async () => {
  const actual = await vi.importActual<typeof import('../../services/chatService')>('../../services/chatService')
  return {
    ...actual,
    parseChatApiConfig: vi.fn(),
  }
})

vi.mock('../../services/sharedChatRuntime', () => ({
  useSharedChatRuntime: vi.fn(),
}))

const mockedLoadCustomAgentApiConfig = vi.mocked(loadCustomAgentApiConfig)
const mockedViewCustomAgent = vi.mocked(viewCustomAgent)
const mockedParseChatApiConfig = vi.mocked(parseChatApiConfig)
const mockedUseSharedChatRuntime = vi.mocked(useSharedChatRuntime)

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

const MOCK_AGENT: AgentDetail = {
  agent_id: 'agent-1',
  creator_user_id: '123456',
  agent_name: '测试智能体',
  description: '测试描述',
  avatar_url: '',
  agent_prompt: '你是测试智能体',
  enabled_skills: [],
  resource_ids: [],
  preset_questions: [],
  enable_web_search: false,
  is_active: true,
  is_public: false,
  created_at: '2026-04-14T00:00:00Z',
  updated_at: '2026-04-14T00:00:00Z',
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

async function flushAsyncTasks() {
  await Promise.resolve()
  await Promise.resolve()
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agent/agent-1/chat?sessionId=session-1']}>
      <LocationProbe />
      <Routes>
        <Route path="/agent/:id/chat" element={<AgentConversationPage />} />
        <Route path="/agent/:id" element={<div>详情页</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AgentConversationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadCustomAgentApiConfig.mockResolvedValue(MOCK_CONFIG)
    mockedViewCustomAgent.mockResolvedValue(MOCK_AGENT)
    mockedParseChatApiConfig.mockReturnValue({
      createSessionEndpoint: 'http://localhost:8000/api/v1/chat/sessions',
      streamEndpointBase: 'http://localhost:8000/api/v1/chat/sessions',
    })
    mockedUseSharedChatRuntime.mockReturnValue({
      draft: '',
      setDraft: vi.fn(),
      messages: [],
      groupedMessages: [],
      assistantCopyTargets: {},
      copiedMessageId: null,
      handleCopy: vi.fn(),
      handleSend: vi.fn(),
      isResponding: false,
      requestError: '',
      sessionLoading: false,
      getToolDisplayTitle: vi.fn(),
      getToolDisplaySummary: vi.fn(),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('url: http://localhost:8000'),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('点击设置按钮后会直接跳到智能体详情页，并带有编辑智能体提示', async () => {
    renderPage()

    await waitFor(() => {
      expect(mockedViewCustomAgent).toHaveBeenCalledWith(MOCK_CONFIG, 'agent-1')
    })

    await act(async () => {
      await flushAsyncTasks()
    })

    const editButton = screen.getByRole('button', { name: '编辑智能体' })
    expect(editButton).toHaveAttribute('data-tooltip', '编辑智能体')

    fireEvent.click(editButton)

    expect(screen.getByTestId('location')).toHaveTextContent('/agent/agent-1')
    expect(screen.getByText('详情页')).toBeInTheDocument()
  })

  it('输入框底栏直接提供联网检索配置，并且附件菜单不再展示工具入口', async () => {
    mockedViewCustomAgent.mockResolvedValueOnce({
      ...MOCK_AGENT,
      enable_web_search: true,
    })

    renderPage()

    await waitFor(() => {
      expect(mockedViewCustomAgent).toHaveBeenCalledWith(MOCK_CONFIG, 'agent-1')
    })

    const webSearchSwitch = await screen.findByRole('switch', { name: '联网检索' })

    expect(screen.queryByText('联网检索')).not.toBeInTheDocument()
    expect(webSearchSwitch).toHaveAttribute('aria-checked', 'true')
    expect(webSearchSwitch).toHaveAttribute('data-state', 'enabled')
    expect(screen.getByTestId('attachment-menu')).toHaveAttribute('data-show-tools', 'false')

    fireEvent.click(webSearchSwitch)
    expect(webSearchSwitch).toHaveAttribute('aria-checked', 'false')
    expect(webSearchSwitch).toHaveAttribute('data-state', 'disabled')

    fireEvent.click(webSearchSwitch)
    expect(webSearchSwitch).toHaveAttribute('aria-checked', 'true')
    expect(webSearchSwitch).toHaveAttribute('data-state', 'enabled')
  })

  it('联网检索不可配置时点击会提示当前状态', async () => {
    renderPage()

    await waitFor(() => {
      expect(mockedViewCustomAgent).toHaveBeenCalledWith(MOCK_CONFIG, 'agent-1')
    })

    const webSearchSwitch = await screen.findByRole('switch', { name: '联网检索' })
    expect(webSearchSwitch).toHaveAttribute('data-state', 'locked')
    expect(webSearchSwitch).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(webSearchSwitch)

    expect(mockedMessageInfo).toHaveBeenCalledWith('当前智能体未开启联网检索，暂不可配置')
  })
})
