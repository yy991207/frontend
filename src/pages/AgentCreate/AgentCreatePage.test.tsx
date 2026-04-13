import { act, fireEvent, render, screen } from '@testing-library/react'
import { message } from 'antd'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import AgentCreatePage from './AgentCreatePage'
import {
  getAgentTemplateTask,
  loadCustomAgentApiConfig,
  type AgentTemplateTaskResponse,
  type CustomAgentApiConfig,
  type RecommendedSkill,
} from '../../services/customAgentService'

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

vi.mock('../../services/ossUploadService', () => ({
  createPendingUploadedFile: vi.fn(),
  uploadPendingFileToOss: vi.fn(),
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
const mockedGetAgentTemplateTask = vi.mocked(getAgentTemplateTask)

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

const MOCK_RECOMMENDED_SKILLS: RecommendedSkill[] = [
  {
    name: 'ai-drawing',
    chinese_name: 'AI 绘图',
    description: '生成图片',
    source: 'guoren',
    template: '画一张图',
    placeholders: null,
    config_fields: null,
    is_selected: false,
  },
]

const BASE_TEMPLATE = {
  agentName: '西行智者',
  description: '提供佛法知识',
  agentPrompt: '你是一个智能体',
  presetQuestions: [],
}

function createTaskResponse(
  phase: 'recommending' | 'completed',
  recommendedSkills: RecommendedSkill[] | null = null,
): AgentTemplateTaskResponse {
  return {
    success: true,
    code: '200',
    msg: 'success',
    data: {
      task_id: 'task-1',
      status: phase === 'completed' ? 'completed' : 'running',
      phase,
      progress: {
        agent_name: true,
        description: true,
        agent_prompt: true,
        preset_questions: true,
        recommended_skills: phase === 'completed',
      },
      is_completed: phase === 'completed',
      result: {
        agent_name: BASE_TEMPLATE.agentName,
        description: BASE_TEMPLATE.description,
        agent_prompt: BASE_TEMPLATE.agentPrompt,
        preset_questions: [],
        recommended_skills: recommendedSkills ?? [],
      },
      error: null,
    },
  }
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
    vi.spyOn(message, 'success').mockImplementation(() => (() => {}) as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('推荐技能还没完成时，右侧 Skills 服务区域显示技能推荐中的 loading 文案', async () => {
    mockedGetAgentTemplateTask.mockResolvedValue(createTaskResponse('recommending'))

    renderPage()

    expect(await screen.findByText('技能推荐中...')).toBeInTheDocument()
  })

  it('同一个 taskId 做 replace 跳转后，推荐技能轮询不会中断', async () => {
    vi.useFakeTimers()
    mockedGetAgentTemplateTask
      .mockResolvedValueOnce(createTaskResponse('recommending'))
      .mockResolvedValueOnce(createTaskResponse('completed', MOCK_RECOMMENDED_SKILLS))

    renderPage()

    await act(async () => {
      await flushAsyncTasks()
    })
    expect(mockedGetAgentTemplateTask).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('replace-state'))

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await flushAsyncTasks()
    })

    expect(mockedGetAgentTemplateTask).toHaveBeenCalledTimes(2)
  })
})
