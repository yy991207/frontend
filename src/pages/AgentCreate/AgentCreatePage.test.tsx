import { act, fireEvent, render, screen } from '@testing-library/react'
import { message } from 'antd'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import AgentCreatePage from './AgentCreatePage'
import {
  loadCustomAgentApiConfig,
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

vi.mock('../../components/chat/artifact-file-detail', () => ({
  ArtifactFileDetail: () => null,
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

vi.mock('../../services/ossUploadService', async () => {
  const actual = await vi.importActual<typeof import('../../services/ossUploadService')>('../../services/ossUploadService')
  return {
    ...actual,
    createPendingUploadedFile: vi.fn(),
    uploadPendingFileToOss: vi.fn(),
  }
})

vi.mock('../../services/agentFileUploadService', () => ({
  uploadPendingFileToOssWithDocumentParse: vi.fn(),
}))

vi.mock('../../services/customAgentService', async () => {
  const actual = await vi.importActual<typeof import('../../services/customAgentService')>('../../services/customAgentService')
  return {
    ...actual,
    loadCustomAgentApiConfig: vi.fn(),
    getAgentTemplateTask: vi.fn(),
    createCustomAgent: vi.fn(),
    chatCustomAgentStream: vi.fn(),
  }
})

const mockedLoadCustomAgentApiConfig = vi.mocked(loadCustomAgentApiConfig)
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

const BASE_TEMPLATE = {
  agentName: '西行智者',
  description: '提供佛法知识',
  agentPrompt: '你是一个智能体',
  presetQuestions: [],
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

function ReplaceStateButton() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => {
        navigate('/agent/create', {
          replace: true,
          state: {
            generatedTemplate: { ...BASE_TEMPLATE },
            taskId: 'task-1',
          },
        })
      }}
    >
      replace-state
    </button>
  )
}

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/agent/create',
          state: {
            generatedTemplate: { ...BASE_TEMPLATE },
            taskId: 'task-1',
          },
        },
      ]}
    >
      <Routes>
        <Route
          path="/agent/create"
          element={(
            <>
              <ReplaceStateButton />
              <AgentCreatePage />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

async function flushAsyncTasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('AgentCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadCustomAgentApiConfig.mockResolvedValue(MOCK_CONFIG)
    mockedCreatePendingUploadedFile.mockReturnValue(PENDING_FILE)
    mockedUploadPendingFileToOssWithDocumentParse.mockResolvedValue(COMPLETED_FILE)
    vi.spyOn(message, 'success').mockImplementation(() => (() => {}) as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('创建页即使收到旧的 taskId，也不再显示技能推荐 loading 或继续轮询', async () => {
    vi.useFakeTimers()

    renderPage()

    expect(screen.queryByText('技能推荐中...')).not.toBeInTheDocument()

    await act(async () => {
      await flushAsyncTasks()
      fireEvent.click(screen.getByText('replace-state'))
      vi.advanceTimersByTime(4000)
      await flushAsyncTasks()
    })

    const customAgentService = await import('../../services/customAgentService')
    expect(vi.mocked(customAgentService.getAgentTemplateTask)).not.toHaveBeenCalled()
  })

  it('创建页上传文件时会走文档解析上传服务', async () => {
    const { container } = renderPage()
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

  it('创建页自定义智能体主头像应为白底黑字', () => {
    renderPage()

    const avatarLetter = screen.getByText('西')
    expect(avatarLetter.parentElement).toHaveStyle({
      background: '#ffffff',
    })
    expect(avatarLetter).toHaveStyle({
      color: '#1f2329',
    })
  })
})
