import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { ChatComposer } from './ChatComposer'

const mockedAttachmentMenu = vi.fn()
const mockedSkillSlashCommand = vi.fn()

vi.mock('./AttachmentMenu', () => ({
  AttachmentMenu: (props: Record<string, unknown>) => {
    mockedAttachmentMenu(props)
    return <div data-testid="attachment-menu" />
  },
}))

vi.mock('./SkillSlashCommand', () => ({
  SkillSlashCommand: (props: { variant?: string }) => {
    mockedSkillSlashCommand(props)
    return <div data-testid="skill-slash-command" data-variant={props.variant ?? 'default'} />
  },
}))

vi.mock('./FileAttachmentPreview', () => ({
  FileAttachmentPreview: () => null,
}))

vi.mock('./SkillTemplateInput', () => ({
  default: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
  }: {
    value: string
    onChange: (value: string) => void
    onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>
    placeholder: string
  }) => (
    <textarea
      aria-label="聊天输入框"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  ),
}))

function createProps(overrides: Partial<React.ComponentProps<typeof ChatComposer>> = {}): React.ComponentProps<typeof ChatComposer> {
  return {
    value: '',
    onChange: vi.fn(),
    onKeyDown: vi.fn(),
    onSend: vi.fn(),
    placeholder: '输入内容',
    slashCommandOpen: true,
    slashQuery: '',
    onSlashQueryChange: vi.fn(),
    skills: [],
    filteredSkills: [],
    skillsLoading: false,
    loadSkills: vi.fn(async () => {}),
    selectedSkillIndex: 0,
    onSelectSkill: vi.fn(),
    onCloseSlashCommand: vi.fn(),
    onManageSkills: vi.fn(),
    uploadedFiles: [],
    onRemoveFile: vi.fn(),
    fileInputRef: createRef<HTMLInputElement>(),
    onFileChange: vi.fn(),
    onUploadFile: vi.fn(),
    webSearchEnabled: true,
    knowledgeEnabled: false,
    onToggleWebSearch: vi.fn(),
    onToggleKnowledge: vi.fn(),
    sendDisabled: false,
    ...overrides,
  }
}

describe('ChatComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('默认模式继续展示附件菜单，并保持默认技能面板样式', () => {
    render(<ChatComposer {...createProps()} />)

    expect(screen.getByTestId('attachment-menu')).toBeInTheDocument()
    expect(screen.getByTestId('skill-slash-command')).toHaveAttribute('data-variant', 'default')
    expect(screen.queryByRole('button', { name: '上传附件' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: '联网检索' })).not.toBeInTheDocument()
  })

  it('agentConversation 模式展示内联附件和联网开关，不再渲染附件菜单', () => {
    const onUploadFile = vi.fn()
    const onToggleWebSearch = vi.fn()

    render(
      <ChatComposer
        {...createProps({
          variant: 'agentConversation',
          onUploadFile,
          onToggleWebSearch,
        })}
      />,
    )

    expect(screen.queryByTestId('attachment-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('skill-slash-command')).toHaveAttribute('data-variant', 'agentConversation')
    expect(screen.getByRole('button', { name: '上传附件' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '联网检索' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: '上传附件' }))
    expect(onUploadFile).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('switch', { name: '联网检索' }))
    expect(onToggleWebSearch).toHaveBeenCalledTimes(1)
  })

  it('agentConversation 模式下联网锁定时点击走锁定回调', () => {
    const onToggleWebSearch = vi.fn()
    const onLockedWebSearchClick = vi.fn()

    render(
      <ChatComposer
        {...createProps({
          variant: 'agentConversation',
          webSearchEnabled: false,
          webSearchLocked: true,
          onToggleWebSearch,
          onLockedWebSearchClick,
        })}
      />,
    )

    const webSearchSwitch = screen.getByRole('switch', { name: '联网检索' })

    expect(webSearchSwitch).toHaveAttribute('data-state', 'locked')
    expect(webSearchSwitch).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(webSearchSwitch)

    expect(onLockedWebSearchClick).toHaveBeenCalledTimes(1)
    expect(onToggleWebSearch).not.toHaveBeenCalled()
  })
})
