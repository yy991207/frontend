import { act, fireEvent, render, screen } from '@testing-library/react'
import CreateAgentModal from './CreateAgentModal'
import {
  generateAgentTemplate,
  getAgentTemplateTask,
  getAgentTemplates,
  loadCustomAgentApiConfig,
  type AgentTemplateTaskResponse,
  type CustomAgentApiConfig,
  type RecommendedSkill,
} from '../../services/customAgentService'

const mockedNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  }
})

vi.mock('../../services/customAgentService', async () => {
  const actual = await vi.importActual<typeof import('../../services/customAgentService')>('../../services/customAgentService')
  return {
    ...actual,
    loadCustomAgentApiConfig: vi.fn(),
    generateAgentTemplate: vi.fn(),
    getAgentTemplateTask: vi.fn(),
    getAgentTemplates: vi.fn(),
    getAgentTemplateDetail: vi.fn(),
  }
})

const mockedLoadCustomAgentApiConfig = vi.mocked(loadCustomAgentApiConfig)
const mockedGenerateAgentTemplate = vi.mocked(generateAgentTemplate)
const mockedGetAgentTemplateTask = vi.mocked(getAgentTemplateTask)
const mockedGetAgentTemplates = vi.mocked(getAgentTemplates)

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

function createTaskResponse(
  phase: 'recommending' | 'completed',
  recommendedSkills: RecommendedSkill[] = [],
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
        agent_name: '西行智者',
        description: '提供佛法知识',
        agent_prompt: '你是一个智能体',
        preset_questions: [],
        recommended_skills: recommendedSkills,
      },
      error: null,
    },
  }
}

async function flushAsyncTasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('CreateAgentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadCustomAgentApiConfig.mockResolvedValue(MOCK_CONFIG)
    mockedGetAgentTemplates.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('只有 phase=completed 时才会进入创建页', async () => {
    vi.useFakeTimers()
    mockedGenerateAgentTemplate.mockResolvedValue({
      success: true,
      code: '200',
      msg: 'success',
      data: {
        task_id: 'task-1',
        status: 'running',
      },
    })
    mockedGetAgentTemplateTask
      .mockResolvedValueOnce(createTaskResponse('recommending'))
      .mockResolvedValueOnce(createTaskResponse('completed', MOCK_RECOMMENDED_SKILLS))

    const onCancel = vi.fn()
    render(<CreateAgentModal visible onCancel={onCancel} />)

    const textarea = screen.getByPlaceholderText(/比如：你想要一个财报分析助手/)
    fireEvent.change(textarea, { target: { value: '做一个财报分析助手' } })

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
      await flushAsyncTasks()
    })

    expect(mockedNavigate).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await flushAsyncTasks()
    })

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockedNavigate).toHaveBeenCalledWith('/agent/create', {
      state: {
        generatedTemplate: {
          agentName: '西行智者',
          description: '提供佛法知识',
          agentPrompt: '你是一个智能体',
          presetQuestions: [],
          recommendedSkills: MOCK_RECOMMENDED_SKILLS,
        },
      },
    })
  })
})
