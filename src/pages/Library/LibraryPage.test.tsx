import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LibraryPage from './LibraryPage'

vi.mock('./LibraryFilePreviewModal', () => ({
  LibraryFilePreviewModal: () => null,
}))

describe('LibraryPage', () => {
  let mockFiles: Array<{
    file_id: string
    file_name: string
    agent_name: string
    file_type: string
    file_path: string
    created_at: string
    session_id: string
  }>

  beforeEach(() => {
    mockFiles = [
      {
        file_id: 'file-1',
        file_name: 'hello_world.py',
        agent_name: '通用智能体伙伴',
        file_type: 'other',
        file_path: '/tmp/hello_world.py',
        created_at: '2026-04-18T08:00:00.000Z',
        session_id: 'session-1',
      },
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

        if (url === '/config.yaml') {
          return {
            ok: true,
            text: async () => 'user_id: 123456\nurl: http://localhost:8000/\ntoken: test-token',
          }
        }

        if (url.includes('/api/v1/files/library')) {
          return {
            ok: true,
            json: async () => ({
              files: mockFiles,
              total: mockFiles.length,
            }),
          }
        }

        throw new Error(`Unexpected fetch url: ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('名称列不再显示头像圆标', async () => {
    const { container } = render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('hello_world.py')).toBeVisible()

    await waitFor(() => {
      expect(container.querySelector('[class*="fileIcon"]')).toBeNull()
    })
  })

  it('第一页最多显示 16 条，并使用更紧凑的 antd small 表格尺寸', async () => {
    mockFiles = Array.from({ length: 17 }, (_, index) => ({
      file_id: `file-${index + 1}`,
      file_name: `file-${index + 1}.txt`,
      agent_name: '通用智能体伙伴',
      file_type: 'document',
      file_path: `/tmp/file-${index + 1}.txt`,
      created_at: '2026-04-18T08:00:00.000Z',
      session_id: `session-${index + 1}`,
    }))

    const { container } = render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('file-1.txt')).toBeVisible()
    expect(await screen.findByText('file-16.txt')).toBeVisible()
    expect(screen.queryByText('file-17.txt')).not.toBeInTheDocument()
    expect(screen.getByText('第 1/2 页，共 17 条')).toBeVisible()
    expect(container.querySelector('.ant-table-small')).not.toBeNull()
  })
})
