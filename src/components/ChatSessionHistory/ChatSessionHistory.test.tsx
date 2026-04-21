import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChatSessionHistory from './ChatSessionHistory'
import {
  fetchChatSessions,
  type ChatSession,
} from '../../services/chatSessionService'

vi.mock('../../services/chatSessionService', async () => {
  const actual = await vi.importActual<typeof import('../../services/chatSessionService')>('../../services/chatSessionService')
  return {
    ...actual,
    fetchChatSessions: vi.fn(),
    deleteChatSession: vi.fn(),
  }
})

const mockedFetchChatSessions = vi.mocked(fetchChatSessions)

const MOCK_SESSIONS: ChatSession[] = [
  {
    session_id: 'session-1',
    session_name: '当前会话',
    user_id: '123456',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    agent_id: null,
  },
]

describe('ChatSessionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedFetchChatSessions.mockResolvedValue(MOCK_SESSIONS)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => 'user_id: 123456\nurl: http://localhost:8000/',
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('当前会话行应使用统一的选中背景样式', async () => {
    render(
      <MemoryRouter initialEntries={['/chat?sessionId=session-1']}>
        <ChatSessionHistory expanded />
      </MemoryRouter>,
    )

    const activeSessionName = await screen.findByText('当前会话')
    const activeSessionRow = activeSessionName.closest('[aria-current="page"]')

    expect(activeSessionRow).not.toBeNull()
    expect(activeSessionRow?.className).toContain('sessionItemActive')
  })
})
