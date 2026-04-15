import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { message } from 'antd'
import { SaveCommandModal } from './SaveCommandModal'
import * as commandsService from '../../services/commandsService'

vi.mock('../../services/commandsService', async () => {
  const actual = await vi.importActual('../../services/commandsService')
  return {
    ...actual,
    generateCommandFromSession: vi.fn(),
    createCommand: vi.fn(),
  }
})

describe('SaveCommandModal', () => {
  const onClose = vi.fn()
  const onSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(message, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('返回 null 当 open 为 false', () => {
    const { container } = render(
      <SaveCommandModal open={false} sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('打开后显示 loading 阶段', () => {
    vi.mocked(commandsService.generateCommandFromSession).mockReturnValue(
      new Promise(() => {}),
    )

    render(
      <SaveCommandModal open sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )

    expect(screen.getByText('正在生成指令模板')).toBeVisible()
    expect(screen.getByText('AI 正在分析当前会话内容，提取关键指令...')).toBeVisible()
  })

  it('step 1 完成后切换到 editing 阶段并填充表单数据', async () => {
    vi.mocked(commandsService.generateCommandFromSession).mockResolvedValue({
      name: '天气查询',
      template: '查询/地点天气',
      attachments: [],
      source_session_id: 'test-session',
    })

    render(
      <SaveCommandModal open sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )

    const nameInput = await screen.findByPlaceholderText('请输入指令名称') as HTMLInputElement
    expect(nameInput.value).toBe('天气查询')
    const templateInput = screen.getByPlaceholderText('请输入指令内容') as HTMLTextAreaElement
    expect(templateInput.value).toBe('查询/地点天气')
    expect(screen.getByText('保存为指令模板')).toBeVisible()
  })

  it('name 为空时点击保存提示错误', async () => {
    vi.mocked(commandsService.generateCommandFromSession).mockResolvedValue({
      name: '天气查询',
      template: '查询/地点天气',
      attachments: [],
      source_session_id: 'test-session',
    })

    render(
      <SaveCommandModal open sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )

    const nameInput = await screen.findByPlaceholderText('请输入指令名称') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: '' } })
    fireEvent.click(screen.getByText('保存'))

    expect(message.error).toHaveBeenCalledWith('指令名称不能为空')
    expect(commandsService.createCommand).not.toHaveBeenCalled()
  })

  it('template 为空时点击保存提示错误', async () => {
    vi.mocked(commandsService.generateCommandFromSession).mockResolvedValue({
      name: '天气查询',
      template: '查询/地点天气',
      attachments: [],
      source_session_id: 'test-session',
    })

    render(
      <SaveCommandModal open sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )

    await screen.findByPlaceholderText('请输入指令名称')
    const templateInput = screen.getByPlaceholderText('请输入指令内容') as HTMLTextAreaElement
    fireEvent.change(templateInput, { target: { value: '' } })
    fireEvent.click(screen.getByText('保存'))

    expect(message.error).toHaveBeenCalledWith('指令内容不能为空')
    expect(commandsService.createCommand).not.toHaveBeenCalled()
  })

  it('两步 API 均成功时调用 onSuccess', async () => {
    vi.mocked(commandsService.generateCommandFromSession).mockResolvedValue({
      name: '天气查询',
      template: '查询/地点天气',
      attachments: [],
      source_session_id: 'test-session',
    })
    vi.mocked(commandsService.createCommand).mockResolvedValue({
      id: '123',
      name: '天气查询',
      template: '查询/地点天气',
      attachments: [],
    })

    render(
      <SaveCommandModal open sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )

    await screen.findByPlaceholderText('请输入指令名称')
    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(commandsService.createCommand).toHaveBeenCalledWith(
        {
          name: '天气查询',
          template: '查询/地点天气',
          attachments: [],
          source_session_id: 'test-session',
        },
        '123456',
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('step 1 失败时提示错误并关闭弹窗', async () => {
    vi.mocked(commandsService.generateCommandFromSession).mockRejectedValue(
      new Error('生成指令模板失败'),
    )

    render(
      <SaveCommandModal open sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('生成指令模板失败')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('step 2 失败时提示错误但保持弹窗打开', async () => {
    vi.mocked(commandsService.generateCommandFromSession).mockResolvedValue({
      name: '天气查询',
      template: '查询/地点天气',
      attachments: [],
      source_session_id: 'test-session',
    })
    vi.mocked(commandsService.createCommand).mockRejectedValue(
      new Error('网络错误'),
    )

    render(
      <SaveCommandModal open sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )

    await screen.findByPlaceholderText('请输入指令名称')
    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('网络错误')
      expect(onClose).not.toHaveBeenCalled()
    })

    expect((screen.getByPlaceholderText('请输入指令名称') as HTMLInputElement).value).toBe('天气查询')
  })

  it('loading 阶段关闭弹窗，竞态清理', async () => {
    let resolveStep1: (value: typeof commandsService.SaveCommandStep1Response) => void
    vi.mocked(commandsService.generateCommandFromSession).mockReturnValue(
      new Promise((resolve) => {
        resolveStep1 = resolve
      }),
    )

    const { unmount } = render(
      <SaveCommandModal open sessionId="test-session" onClose={onClose} onSuccess={onSuccess} />,
    )

    unmount()

    resolveStep1!({
      name: '天气查询',
      template: '查询/地点天气',
      attachments: [],
      source_session_id: 'test-session',
    })

    await waitFor(() => {
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })
})
