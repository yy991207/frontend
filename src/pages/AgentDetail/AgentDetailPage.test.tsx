import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AgentDetailPage from './AgentDetailPage'
import {
  loadCustomAgentApiConfig,
  viewCustomAgent,
  type AgentDetail,
  type CustomAgentApiConfig,
} from '../../services/customAgentService'
import {
  createPendingUploadedFile,
  type UploadedFile,
} from '../../services/ossUploadService'
import { uploadPendingFileToOssWithDocumentParse } from '../../services/agentFileUploadService'

vi.mock('../../components/common/EditAgentModal', () => ({
  default: () => null,
}))

vi.mock('../../components/common/SkillConfigModal', () => ({
  default: () => null,
}))

vi.mock('../../components/common/KnowledgeSpaceModal', () => ({
  default: () => null,
}))

vi.mock('../../components/common/SkillDetailPanel', () => ({
  default: () => null,
}))

vi.mock('../../components/chat/message-list', () => ({
  MessageList: () => <div data-testid="message-list" />,
}))

vi.mock('../../components/common/FileAttachmentPreview', () => ({
  FileAttachmentPreview: () => null,
}))

vi.mock('../../components/common/SkillTemplateInput', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))

vi.mock('../../services/ossUploadService', () => ({
  createPendingUploadedFile: vi.fn(),
  uploadPendingFileToOss: vi.fn(),
}))

vi.mock('../../services/agentFileUploadService', () => ({
  uploadPendingFileToOssWithDocumentParse: vi.fn(),
}))

vi.mock('../../services/customAgentService', async () => {
  const actual = await vi.importActual<typeof import('../../services/customAgentService')>('../../services/customAgentService')
  return {
    ...actual,
    loadCustomAgentApiConfig: vi.fn(),
    updateCustomAgent: vi.fn(),
    viewCustomAgent: vi.fn(),
    chatCustomAgentStream: vi.fn(),
  }
})

vi.mock('../../utils/agentStorage', () => ({
  clearAgentStorage: vi.fn(),
}))

const mockedLoadCustomAgentApiConfig = vi.mocked(loadCustomAgentApiConfig)
const mockedViewCustomAgent = vi.mocked(viewCustomAgent)
const mockedCreatePendingUploadedFile = vi.mocked(createPendingUploadedFile)
const mockedUploadPendingFileToOssWithDocumentParse = vi.mocked(uploadPendingFileToOssWithDocumentParse)

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
  avatar_url: 'https://example.com/avatar.png',
  agent_prompt: '你是测试智能体',
  enabled_skills: [],
  resource_ids: [],
  preset_questions: [],
  enable_web_search: false,
  is_active: true,
  is_public: false,
  created_at: '2026-04-13T00:00:00Z',
  updated_at: '2026-04-13T00:00:00Z',
}

const PENDING_FILE: UploadedFile = {
  id: 'file-1',
  name: '年度报告.pdf',
  size: 1024,
  type: 'application/pdf',
  ext: 'pdf',
  url: '',
  objectKey: 'input/file-1.pdf',
  uploadProgress: 0,
  status: 'uploading',
}

const COMPLETED_FILE: UploadedFile = {
  ...PENDING_FILE,
  url: 'https://example.com/file-1.pdf',
  uploadProgress: 100,
  status: 'completed',
  parseTaskId: 'task-1',
  resourceId: 'resource-1',
}

async function flushAsyncTasks() {
  await Promise.resolve()
  await Promise.resolve()
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agent/agent-1']}>
      <Routes>
        <Route path="/agent/:id" element={<AgentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AgentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadCustomAgentApiConfig.mockResolvedValue(MOCK_CONFIG)
    mockedViewCustomAgent.mockResolvedValue(MOCK_AGENT)
    mockedCreatePendingUploadedFile.mockReturnValue(PENDING_FILE)
    mockedUploadPendingFileToOssWithDocumentParse.mockResolvedValue(COMPLETED_FILE)
  })

  it('编辑页上传文件时会走文档解析上传服务', async () => {
    const { container } = renderPage()

    await waitFor(() => {
      expect(mockedViewCustomAgent).toHaveBeenCalled()
    })

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['demo'], '年度报告.pdf', { type: 'application/pdf' })

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
      await flushAsyncTasks()
    })

    expect(mockedUploadPendingFileToOssWithDocumentParse).toHaveBeenCalledWith(
      PENDING_FILE,
      file,
      expect.objectContaining({
        onProgress: expect.any(Function),
        onStatusChange: expect.any(Function),
      }),
    )
  })

  it('自定义智能体主头像应为白底黑字', async () => {
    renderPage()

    await waitFor(() => {
      expect(mockedViewCustomAgent).toHaveBeenCalled()
    })

    const avatarLetter = screen.getByText('测')
    expect(avatarLetter.parentElement).toHaveStyle({
      background: '#ffffff',
    })
    expect(avatarLetter).toHaveStyle({
      color: '#1f2329',
    })
  })
})
