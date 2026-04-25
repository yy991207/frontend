import Avatar from 'antd/es/avatar'
import Input from 'antd/es/input'
import type { InputRef } from 'antd/es/input'
import Typography from 'antd/es/typography'
import { CheckOutlined, DownOutlined, SearchOutlined, UpOutlined, UserOutlined } from '@ant-design/icons'
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@/types/task'
import './index.less'

interface UserSearchSelectProps {
  users: User[]
  value?: string | string[]
  label?: string
  placeholder?: string
  className?: string
  size?: 'small' | 'middle' | 'large'
  autoFocus?: boolean
  open?: boolean
  style?: CSSProperties
  mode?: 'multiple'
  getPopupContainer?: () => HTMLElement
  optionsVariant?: 'floating' | 'inline'
  onChange: (value?: string | string[]) => void
  onOpenChange?: (open: boolean) => void
}

const USER_AVATAR_FALLBACK_COLOR = '#7b67ee'

function normalizeAvatarSrc(avatar?: string | null): string | undefined {
  if (typeof avatar !== 'string') {
    return undefined
  }
  const trimmed = avatar.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export default function UserSearchSelect({
  users,
  value,
  label,
  placeholder = '搜索用户',
  className,
  size = 'small',
  autoFocus,
  open,
  style,
  mode,
  getPopupContainer: _getPopupContainer,
  optionsVariant = 'floating',
  onChange,
  onOpenChange,
}: UserSearchSelectProps): ReactElement {
  const inputRef = useRef<InputRef>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [internalOpen, setInternalOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const isInlineAlwaysOpen = optionsVariant === 'inline'
  const optionAvatarSize = isInlineAlwaysOpen ? 32 : 24
  const dropdownOpen = isInlineAlwaysOpen ? true : open ?? internalOpen
  const selectedIds = useMemo(
    () => (Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []),
    [value],
  )
  const normalizedSearchText = searchText.trim().toLowerCase()
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (!normalizedSearchText) {
          return true
        }
        return `${user.name} ${user.id}`.toLowerCase().includes(normalizedSearchText)
      }),
    [normalizedSearchText, users],
  )

  useEffect(() => {
    if (autoFocus) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [autoFocus])

  useEffect(() => {
    if (!dropdownOpen) {
      setSearchText('')
    }
  }, [dropdownOpen])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (isInlineAlwaysOpen) {
        return
      }
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      const isClickInsideInlinePanel =
        isInlineAlwaysOpen &&
        target instanceof Element &&
        rootRef.current?.closest('.ant-popover')?.contains(target)

      if (rootRef.current?.contains(target) || isClickInsideInlinePanel) {
        return
      }
      handleDropdownOpenChange(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isInlineAlwaysOpen, optionsVariant])

  const handleDropdownOpenChange = (nextOpen: boolean): void => {
    // 外部传 open 时走受控模式；未传 open 时组件自己维护展开状态，默认保持收起。
    if (open === undefined) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  const handleUserToggle = (userId: string): void => {
    // 输入框只负责搜索，人员增删统一由列表点击切换，避免已选标签挤占搜索区域。
    if (mode === 'multiple') {
      const nextSelectedIds = selectedIds.includes(userId)
        ? selectedIds.filter((id) => id !== userId)
        : [...selectedIds, userId]
      onChange(nextSelectedIds)
      return
    }

    onChange(selectedIds.includes(userId) ? undefined : userId)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      if (!isInlineAlwaysOpen) {
        handleDropdownOpenChange(false)
      }
      return
    }
    if (event.key !== 'Enter' || filteredUsers.length === 0) {
      return
    }
    event.preventDefault()
    handleUserToggle(filteredUsers[0].id)
  }

  const wrapperClassName = [
    'user-search-select',
    dropdownOpen ? 'user-search-select-open' : '',
    optionsVariant === 'inline' ? 'user-search-select-inline' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={rootRef}
      className={wrapperClassName}
      style={style}
      onMouseDown={() => handleDropdownOpenChange(true)}
    >
      {label && (
        <Typography.Text strong className="user-search-select-label">
          {label}
        </Typography.Text>
      )}
      <Input
        ref={inputRef}
        size={size}
        value={searchText}
        placeholder={placeholder}
        prefix={<SearchOutlined />}
        suffix={isInlineAlwaysOpen ? null : dropdownOpen ? <UpOutlined /> : <DownOutlined />}
        allowClear
        onFocus={() => {
          if (!isInlineAlwaysOpen) {
            handleDropdownOpenChange(true)
          }
        }}
        onChange={(event) => setSearchText(event.target.value)}
        onKeyDown={handleSearchKeyDown}
      />
      {(isInlineAlwaysOpen || dropdownOpen) && (
        <div className="user-search-options" role="listbox">
          {filteredUsers.map((user) => {
            const isSelected = selectedIds.includes(user.id)
            const avatarSrc = normalizeAvatarSrc(user.avatar)
            return (
              <button
                key={user.id}
                type="button"
                className={isSelected ? 'user-search-option user-search-option-selected' : 'user-search-option'}
                onClick={() => handleUserToggle(user.id)}
              >
                <Avatar
                  size={optionAvatarSize}
                  src={normalizeAvatarSrc(user.avatar)}
                  icon={avatarSrc ? undefined : <UserOutlined />}
                  className="user-search-option-avatar"
                  style={{ backgroundColor: avatarSrc ? undefined : USER_AVATAR_FALLBACK_COLOR }}
                >
                  {avatarSrc ? null : user.name.slice(0, 1)}
                </Avatar>
                <span className="user-search-option-name">{user.name}</span>
                {isSelected && <CheckOutlined className="user-search-option-check" />}
              </button>
            )
          })}
          {filteredUsers.length === 0 && (
            <div className="user-search-empty">未找到人员</div>
          )}
        </div>
      )}
    </div>
  )
}
