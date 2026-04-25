import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import Button from 'antd/es/button'
import Input from 'antd/es/input'
import Popover from 'antd/es/popover'
import Select from 'antd/es/select'
import Space from 'antd/es/space'
import Tooltip from 'antd/es/tooltip'
import Typography from 'antd/es/typography'
import Upload from 'antd/es/upload'
import message from 'antd/es/message'
import {
  BoldOutlined,
  ContainerOutlined,
  DeleteOutlined,
  ItalicOutlined,
  LinkOutlined,
  EyeOutlined,
  DownloadOutlined,
  OrderedListOutlined,
  PaperClipOutlined,
  PictureOutlined,
  SendOutlined,
  SmileOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import type { ApiAttachment } from '@/services/attachmentService'
import {
  buildAttachmentPreviewUrl,
  isImageAttachment,
} from '@/services/attachmentService'
import type { User } from '@/types/task'
import './index.less'

const { Text } = Typography

const MentionOutlined = UsergroupAddOutlined
const TASK_RICH_INPUT_EMOJIS = [
  String.fromCodePoint(0x1f600),
  String.fromCodePoint(0x1f604),
  String.fromCodePoint(0x1f60a),
  String.fromCodePoint(0x1f609),
  String.fromCodePoint(0x1f60d),
  String.fromCodePoint(0x1f618),
  String.fromCodePoint(0x1f61c),
  String.fromCodePoint(0x1f61d),
  String.fromCodePoint(0x1f602),
  String.fromCodePoint(0x1f923),
  String.fromCodePoint(0x1f605),
  String.fromCodePoint(0x1f606),
  String.fromCodePoint(0x1f60f),
  String.fromCodePoint(0x1f914),
  String.fromCodePoint(0x1f970),
  String.fromCodePoint(0x1f60e),
  String.fromCodePoint(0x1f973),
  String.fromCodePoint(0x1f929),
  String.fromCodePoint(0x1f642),
  String.fromCodePoint(0x1f643),
  String.fromCodePoint(0x1f60c),
  String.fromCodePoint(0x1f634),
  String.fromCodePoint(0x1f62e),
  String.fromCodePoint(0x1f62d),
  String.fromCodePoint(0x1f622),
  String.fromCodePoint(0x1f621),
  String.fromCodePoint(0x1f92f),
  String.fromCodePoint(0x1f631),
  String.fromCodePoint(0x1f44d),
  String.fromCodePoint(0x1f44e),
  String.fromCodePoint(0x1f44c),
  String.fromCodePoint(0x1f64c),
  String.fromCodePoint(0x1f64f),
  String.fromCodePoint(0x1f91d),
  String.fromCodePoint(0x270c),
  String.fromCodePoint(0x1f44b),
  String.fromCodePoint(0x1f44f),
  String.fromCodePoint(0x1f525),
  String.fromCodePoint(0x1f4af),
  String.fromCodePoint(0x1f680),
  String.fromCodePoint(0x1f389),
  String.fromCodePoint(0x1f38a),
  String.fromCodePoint(0x1f381),
  String.fromCodePoint(0x1f38f),
  String.fromCodePoint(0x1f31f),
  String.fromCodePoint(0x2b50),
  String.fromCodePoint(0x2728),
  String.fromCodePoint(0x1f4a1),
  String.fromCodePoint(0x1f4aa),
  String.fromCodePoint(0x2705),
  String.fromCodePoint(0x274c),
  String.fromCodePoint(0x26a1),
  String.fromCodePoint(0x26a0),
  String.fromCodePoint(0x1f6a8),
  String.fromCodePoint(0x1f4cc),
  String.fromCodePoint(0x1f4ce),
  String.fromCodePoint(0x1f4c5),
  String.fromCodePoint(0x1f4dd),
  String.fromCodePoint(0x1f4e2),
  String.fromCodePoint(0x1f440),
  String.fromCodePoint(0x1f4ac),
  String.fromCodePoint(0x1f4a5),
  String.fromCodePoint(0x1f44a),
  String.fromCodePoint(0x1f9e0),
  String.fromCodePoint(0x1f91f),
  String.fromCodePoint(0x2763),
  String.fromCodePoint(0x2764),
  String.fromCodePoint(0x1f497),
  String.fromCodePoint(0x1f49c),
]

export type TaskRichInputMode = 'description' | 'comment' | 'comment-edit'
export type TaskRichAttachmentSource = 'upload' | 'paste'

export interface TaskRichInputProps {
  mode: TaskRichInputMode
  value: string
  users: User[]
  placeholder?: string
  className?: string
  autoFocus?: boolean
  focusVersion?: number
  disabled?: boolean
  attachments?: ApiAttachment[]
  attachmentOrigins?: Record<string, TaskRichAttachmentSource>
  attachmentUploading?: boolean
  mentionIds?: string[]
  submitLabel?: string
  onChange: (value: string) => void
  onMentionIdsChange?: (mentionIds: string[]) => void
  onSubmit?: (value: string, mentionIds: string[]) => void | Promise<void>
  onBlurCommit?: (value: string, mentionIds: string[]) => void | Promise<void>
  onRequestMentionSearch?: (keyword: string) => User[]
  onRequestAttachmentUpload?: (
    file: File,
  ) => Promise<ApiAttachment | null | undefined> | ApiAttachment | null | undefined
  onAttachmentUploaded?: (attachment: ApiAttachment, source?: TaskRichAttachmentSource) => void
  onPreviewAttachment?: (attachment: ApiAttachment) => void
  onDownloadAttachment?: (attachment: ApiAttachment) => void
  onRemoveAttachment?: (attachmentId: string) => void
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replaceAll('`', '&#96;')
}

function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) return ''
  return `https://${trimmed}`
}

function getParser(): DOMParser | null {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return null
  }
  return new DOMParser()
}

function hasRichTags(input: string): boolean {
  return /<(?:\/?(?:p|div|br|strong|b|em|i|u|s|del|blockquote|ul|ol|li|a|img|span))\b/i.test(
    input,
  )
}

function serializeChildren(node: ParentNode): string {
  let html = ''
  node.childNodes.forEach((child) => {
    html += serializeNode(child)
  })
  return html
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()

  if (tag === 'br') {
    return '<br />'
  }

  if (tag === 'img') {
    const src = sanitizeUrl(element.getAttribute('src') ?? '')
    if (!src) return ''
    const alt = element.getAttribute('alt') ?? ''
    const attachmentId = element.getAttribute('data-attachment-id')
    const attrs = [`src="${escapeAttr(src)}"`]
    if (alt) attrs.push(`alt="${escapeAttr(alt)}"`)
    if (attachmentId) attrs.push(`data-attachment-id="${escapeAttr(attachmentId)}"`)
    return `<img ${attrs.join(' ')} />`
  }

  if (tag === 'a') {
    const href = sanitizeUrl(element.getAttribute('href') ?? '')
    const inner = serializeChildren(element)
    if (!href) return inner
    return `<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer noopener">${inner}</a>`
  }

  if (tag === 'span') {
    const mentionId = element.getAttribute('data-mention-id')
    if (mentionId) {
      const inner = serializeChildren(element) || escapeHtml(element.textContent ?? '')
      return `<span class="task-rich-input-mention" data-mention-id="${escapeAttr(mentionId)}" contenteditable="false">${inner}</span>`
    }
    return serializeChildren(element)
  }

  if (
    tag === 'strong' ||
    tag === 'b' ||
    tag === 'em' ||
    tag === 'i' ||
    tag === 'u' ||
    tag === 's' ||
    tag === 'del' ||
    tag === 'blockquote' ||
    tag === 'ul' ||
    tag === 'ol' ||
    tag === 'li' ||
    tag === 'p' ||
    tag === 'div'
  ) {
    return `<${tag}>${serializeChildren(element)}</${tag}>`
  }

  return serializeChildren(element)
}

export function normalizeRichContent(value: string): string {
  const input = value ?? ''
  if (!input) return ''

  if (!hasRichTags(input)) {
    return escapeHtml(input).replaceAll(/\r?\n/g, '<br />')
  }

  const parser = getParser()
  if (!parser) {
    return escapeHtml(input).replaceAll(/\r?\n/g, '<br />')
  }

  const doc = parser.parseFromString(input, 'text/html')
  return serializeChildren(doc.body)
}

export function isRichContentEmpty(value: string, attachmentCount = 0): boolean {
  const html = normalizeRichContent(value)
  if (attachmentCount > 0) {
    return false
  }

  if (!html) {
    return true
  }

  const parser = getParser()
  if (!parser) {
    return html.replaceAll(/<br\s*\/?>/gi, '').trim().length === 0
  }

  const doc = parser.parseFromString(html, 'text/html')
  const text = (doc.body.textContent ?? '').replaceAll(/\u00a0/g, ' ').trim()
  if (text.length > 0) {
    return false
  }

  return !/<img\b/i.test(html)
}

export function extractMentionIds(value: string): string[] {
  const html = normalizeRichContent(value)
  const parser = getParser()
  if (!parser) return []
  const doc = parser.parseFromString(html, 'text/html')
  return Array.from(doc.body.querySelectorAll('[data-mention-id]'))
    .map((element) => element.getAttribute('data-mention-id'))
    .filter((item): item is string => Boolean(item))
}

function decoratePlainMentionsForReadOnly(value: string): string {
  const parser = getParser()
  if (!parser || !value) return value

  const doc = parser.parseFromString(value, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const current = walker.currentNode
    if (current.nodeType !== Node.TEXT_NODE) continue
    const textNode = current as Text
    const parent = textNode.parentElement
    if (parent?.closest('.task-rich-input-mention, a')) continue
    if (!/@[^\s@<]+/.test(textNode.data)) continue
    textNodes.push(textNode)
  }

  textNodes.forEach((node) => {
    const fragment = doc.createDocumentFragment()
    const parts = node.data.split(/(@[^\s@<]+)/g)
    parts.forEach((part) => {
      if (!part) return
      if (part.startsWith('@')) {
        const span = doc.createElement('span')
        span.className = 'task-rich-input-mention'
        span.textContent = part
        fragment.appendChild(span)
        return
      }
      fragment.appendChild(doc.createTextNode(part))
    })
    node.replaceWith(fragment)
  })

  return doc.body.innerHTML
}

export interface TaskRichTextProps {
  html: string
  className?: string
}

interface ToolbarTooltipTitleProps {
  title: string
  hint?: string
}

export function TaskRichText({ html, className }: TaskRichTextProps) {
  const normalizedHtml = normalizeRichContent(html)
  const displayHtml = decoratePlainMentionsForReadOnly(normalizedHtml)
  if (!normalizedHtml) {
    return null
  }

  return (
    <div
      className={className ? `task-rich-text ${className}` : 'task-rich-text'}
      dangerouslySetInnerHTML={{ __html: displayHtml }}
    />
  )
}

function ToolbarTooltipTitle({ title, hint }: ToolbarTooltipTitleProps) {
  return (
    <span className="task-rich-input-tooltip-title">
      <span>{title}</span>
      {hint && <span className="task-rich-input-tooltip-hint">{hint}</span>}
    </span>
  )
}

export default function TaskRichInput({
  mode,
  value,
  users,
  placeholder = '输入内容',
  className,
  autoFocus,
  focusVersion,
  disabled,
  attachments = [],
  attachmentOrigins = {},
  attachmentUploading = false,
  mentionIds,
  submitLabel = '发送',
  onChange,
  onMentionIdsChange,
  onSubmit,
  onBlurCommit,
  onRequestMentionSearch,
  onRequestAttachmentUpload,
  onAttachmentUploaded,
  onPreviewAttachment,
  onDownloadAttachment,
  onRemoveAttachment,
}: TaskRichInputProps) {
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkHref, setLinkHref] = useState('')
  const editorRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const selectionRef = useRef<Range | null>(null)
  const editorHtmlRef = useRef(normalizeRichContent(value))
  const currentMentionIdsRef = useRef<string[]>(mentionIds ?? [])
  const isDescriptionEditingRef = useRef(false)
  const isComposingRef = useRef(false)

  useEffect(() => {
    if (autoFocus) {
      editorRef.current?.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    if (focusVersion === undefined) return
    editorRef.current?.focus()
  }, [focusVersion])

  useLayoutEffect(() => {
    const nextEditorHtml = normalizeRichContent(value)
    if (mode === 'description' && isDescriptionEditingRef.current) {
      return
    }

    const editor = editorRef.current
    editorHtmlRef.current = nextEditorHtml
    if (editor && editor.innerHTML !== nextEditorHtml) {
      editor.innerHTML = nextEditorHtml
    }
  }, [mode, value])

  useEffect(() => {
    const nextMentionIds = mentionIds ?? []
    currentMentionIdsRef.current = nextMentionIds
  }, [mentionIds])

  const syncFromEditor = () => {
    const editor = editorRef.current
    if (!editor) return

    const nextHtml = normalizeRichContent(editor.innerHTML)

    editorHtmlRef.current = nextHtml

    if (mode === 'description') {
      // 描述区只有真正发生输入时才算进入编辑态，避免只聚焦就挡住后续内容回填。
      isDescriptionEditingRef.current = true
    }

    const extractedMentionIds = extractMentionIds(nextHtml)
    currentMentionIdsRef.current = extractedMentionIds
    onMentionIdsChange?.(extractedMentionIds)
    if (mode === 'description') {
      // 描述区是本地编辑态，不在输入过程中回写父组件，避免每次按键都触发重绘。
      return
    }
    onChange(nextHtml)
  }

  const saveSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      selectionRef.current = null
      return
    }

    const range = selection.getRangeAt(0)
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange()
    }
  }

  const restoreSelection = () => {
    const selection = window.getSelection()
    if (!selection || !selectionRef.current) return

    selection.removeAllRanges()
    selection.addRange(selectionRef.current)
  }

  const insertHtml = (html: string) => {
    const editor = editorRef.current
    if (!editor || disabled) return

    editor.focus()
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    syncFromEditor()
  }

  const applyCommand = (command: string, value?: string) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    syncFromEditor()
  }

  const mentionUsers = (onRequestMentionSearch?.(mentionSearch) ?? users).filter((user) => {
    const keyword = mentionSearch.trim().toLowerCase()
    if (!keyword) return true
    return user.name.toLowerCase().includes(keyword) || user.id.toLowerCase().includes(keyword)
  })

  const handleSelectMention = (userId: string) => {
    const target = mentionUsers.find((user) => user.id === userId)
    if (!target) return

    const mentionHtml = `<span class="task-rich-input-mention" data-mention-id="${escapeAttr(target.id)}" contenteditable="false">@${escapeHtml(target.name)}</span>&nbsp;`
    insertHtml(mentionHtml)
    setMentionOpen(false)
    setMentionSearch('')
  }

  const handleSelectEmoji = (emoji: string) => {
    insertHtml(escapeHtml(emoji))
    setEmojiOpen(false)
  }

  const handleLinkConfirm = () => {
    const href = sanitizeUrl(linkHref)
    if (!href) {
      message.error('请输入有效链接')
      return
    }

    const selectionText = selectionRef.current?.toString().trim() ?? ''
    const displayText = linkLabel.trim() || selectionText || href
    const linkHtml = `<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(displayText)}</a>`
    insertHtml(linkHtml)
    setLinkOpen(false)
    setLinkLabel('')
    setLinkHref('')
  }

  const handleUploadAttachment = async (file: File) => {
    if (!onRequestAttachmentUpload) return false

    const created = await onRequestAttachmentUpload(file)
    if (created) {
      onAttachmentUploaded?.(created, 'upload')
    }
    if (mode === 'description' && created && isImageAttachment(created)) {
      const imageHtml = `<img src="${escapeAttr(buildAttachmentPreviewUrl(created))}" data-attachment-id="${escapeAttr(created.attachment_id)}" alt="${escapeAttr(created.file_name)}" />`
      insertHtml(imageHtml)
    }

    return false
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled || !onRequestAttachmentUpload) return

    const items = Array.from(event.clipboardData.items)
    const imageItems = items.filter((item) => item.type.startsWith('image/'))
    if (imageItems.length === 0) return

    event.preventDefault()

    void (async () => {
      for (const item of imageItems) {
        const file = item.getAsFile()
        if (!file) continue
        const created = await onRequestAttachmentUpload(file)
        if (created) {
          onAttachmentUploaded?.(created, 'paste')
        }
        if (mode === 'description' && created && isImageAttachment(created)) {
          const imageHtml = `<img src="${escapeAttr(buildAttachmentPreviewUrl(created))}" data-attachment-id="${escapeAttr(created.attachment_id)}" alt="${escapeAttr(created.file_name)}" />`
          insertHtml(imageHtml)
        }
      }
    })()
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return

    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      (mode === 'comment' || mode === 'comment-edit')
    ) {
      if (event.nativeEvent.isComposing || isComposingRef.current) {
        return
      }

      event.preventDefault()
      if (isRichContentEmpty(editorHtmlRef.current, attachments.length)) {
        return
      }
      void onSubmit?.(editorHtmlRef.current, currentMentionIdsRef.current)
      return
    }

    if (event.key === '@') {
      event.preventDefault()
      saveSelection()
      setMentionOpen(true)
      setMentionSearch('')
      return
    }

    if (event.key === 'Escape') {
      setMentionOpen(false)
      setEmojiOpen(false)
      setLinkOpen(false)
    }
  }

  const handleRootBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (mode !== 'description' || disabled) return
    const nextFocus = event.relatedTarget as Node | null
    if (
      nextFocus &&
      (wrapperRef.current?.contains(nextFocus) ||
        (nextFocus instanceof Element && nextFocus.closest('.task-rich-input-overlay')))
    ) {
      return
    }
    isDescriptionEditingRef.current = false
    void onBlurCommit?.(editorHtmlRef.current, currentMentionIdsRef.current)
  }

  const getOverlayPopupContainer = () => document.body

  useEffect(() => {
    if (mode !== 'description' || disabled) {
      return undefined
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      const wrapper = wrapperRef.current
      if (target instanceof Element && target.closest('.task-rich-input-overlay')) {
        return
      }
      if (!wrapper || wrapper.contains(target)) {
        return
      }

      // 描述区是自动保存模式，点到组件外时主动失焦，避免浏览器没有触发 blur。
      editorRef.current?.blur()
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
    }
  }, [mode, disabled])

  const handleEditorFocus = () => {
    saveSelection()
  }

  const renderAttachmentItem = (attachment: ApiAttachment) => {
    const attachmentSource = attachmentOrigins[attachment.attachment_id] ?? 'upload'
    const ext = (attachment.file_name.split('.').pop() ?? '').toLowerCase()
    const sizeKB = attachment.file_size / 1024
    const sizeLabel =
      sizeKB >= 1024
        ? `${(sizeKB / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(sizeKB))} KB`

    if (attachmentSource === 'paste' && isImageAttachment(attachment)) {
      return (
        <div key={attachment.attachment_id} className="comment-image-preview-item">
          <button
            type="button"
            className="comment-image-card"
            onClick={() => onPreviewAttachment?.(attachment)}
          >
            <img
              className="comment-image-thumb"
              src={buildAttachmentPreviewUrl(attachment)}
              alt={attachment.file_name}
            />
          </button>
          {onRemoveAttachment && (
            <Tooltip title="移除评论图片" placement="top">
              <Button
                type="text"
                size="small"
                danger
                className="attachment-delete comment-image-delete"
                onClick={() => onRemoveAttachment(attachment.attachment_id)}
              >
                删除
              </Button>
            </Tooltip>
          )}
        </div>
      )
    }

    return (
      <div key={attachment.attachment_id} className="detail-attachment-card">
        <div className="attachment-thumb">
          <span className="attachment-ext">{ext || 'FILE'}</span>
        </div>
        <div className="attachment-main">
          <div className="attachment-name" title={attachment.file_name}>
            {attachment.file_name}
          </div>
          <div className="attachment-meta">{sizeLabel}</div>
        </div>
        <div className="attachment-actions">
          {onPreviewAttachment && (
            <Button
              type="text"
              size="small"
              className="attachment-action"
              onClick={() => onPreviewAttachment?.(attachment)}
              icon={<EyeOutlined />}
              title="预览"
            />
          )}
          {onDownloadAttachment && (
            <Button
              type="text"
              size="small"
              className="attachment-action"
              onClick={() => onDownloadAttachment(attachment)}
              icon={<DownloadOutlined />}
              title="下载"
            />
          )}
          {onRemoveAttachment && (
            <Button
              type="text"
              size="small"
              danger
              className="attachment-delete"
              onClick={() => onRemoveAttachment(attachment.attachment_id)}
              icon={<DeleteOutlined />}
              title="删除"
            />
          )}
        </div>
      </div>
    )
  }

  const handleToolbarMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    // Popover 通过 portal 挂到当前输入组件里，事件仍会冒泡到工具栏；这里放过浮层内部输入框，避免链接弹层无法聚焦编辑。
    if (target instanceof Element && target.closest('.task-rich-input-overlay')) {
      return
    }
    event.preventDefault()
  }

  const handleEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const anchor = target.closest('a[href]')
    if (!anchor || !(anchor instanceof HTMLAnchorElement)) {
      return
    }

    event.preventDefault()
    window.open(anchor.href, '_blank', 'noopener,noreferrer')
  }

  const renderToolbarTooltip = (title: string, child: ReactNode, hint?: string) => (
    <Tooltip
      title={<ToolbarTooltipTitle title={title} hint={hint} />}
      placement="top"
      mouseEnterDelay={0.2}
      getPopupContainer={getOverlayPopupContainer}
    >
      {child}
    </Tooltip>
  )

  const renderToolbar = () => (
    <div className="task-rich-input-toolbar" onMouseDown={handleToolbarMouseDown}>
      <div className="task-rich-input-toolbar-left">
        {renderToolbarTooltip(
          '正文样式：加粗',
          <Button
            type="text"
            size="small"
            className="task-rich-input-tool-btn"
            icon={<BoldOutlined />}
            aria-label="加粗"
            onClick={() => applyCommand('bold')}
          />,
          '让选中的文字加粗',
        )}
        {renderToolbarTooltip(
          '正文样式：斜体',
          <Button
            type="text"
            size="small"
            className="task-rich-input-tool-btn"
            icon={<ItalicOutlined />}
            aria-label="斜体"
            onClick={() => applyCommand('italic')}
          />,
          '让选中的文字倾斜',
        )}
        {renderToolbarTooltip(
          '正文样式：下划线',
          <Button
            type="text"
            size="small"
            className="task-rich-input-tool-btn"
            icon={<UnderlineOutlined />}
            aria-label="下划线"
            onClick={() => applyCommand('underline')}
          />,
          '给选中的文字添加下划线',
        )}
        {renderToolbarTooltip(
          '正文样式：有序列表',
          <Button
            type="text"
            size="small"
            className="task-rich-input-tool-btn"
            icon={<OrderedListOutlined />}
            aria-label="有序列表"
            onClick={() => applyCommand('insertOrderedList')}
          />,
          '把当前段落变成编号列表',
        )}
        {renderToolbarTooltip(
          '正文样式：无序列表',
          <Button
            type="text"
            size="small"
            className="task-rich-input-tool-btn"
            icon={<UnorderedListOutlined />}
            aria-label="无序列表"
            onClick={() => applyCommand('insertUnorderedList')}
          />,
          '把当前段落变成项目符号列表',
        )}
        {renderToolbarTooltip(
          '正文样式：引用',
          <Button
            type="text"
            size="small"
            className="task-rich-input-tool-btn"
            icon={<ContainerOutlined />}
            aria-label="引用"
            onClick={() => applyCommand('formatBlock', 'blockquote')}
          />,
          '把当前段落设置为引用块',
        )}
      </div>
      <div className="task-rich-input-toolbar-right">
        <Popover
          open={emojiOpen}
          onOpenChange={setEmojiOpen}
          trigger="click"
          placement="topLeft"
          overlayClassName="task-rich-input-overlay task-rich-input-emoji-overlay"
          getPopupContainer={getOverlayPopupContainer}
          content={
            <div className="task-rich-input-emoji-panel">
              <Text strong>常用表情</Text>
              <div className="task-rich-input-emoji-grid">
                {TASK_RICH_INPUT_EMOJIS.map((emoji) => (
                  <Button
                    key={emoji}
                    type="text"
                    size="small"
                    className="task-rich-input-emoji-btn"
                    aria-label="插入表情"
                    onClick={() => handleSelectEmoji(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          }
        >
          {renderToolbarTooltip(
            '表情：插入表情符号',
            <Button
              type="text"
              size="small"
              className="task-rich-input-tool-btn"
              icon={<SmileOutlined />}
              aria-label="表情"
              onMouseDown={(event) => {
                event.preventDefault()
                saveSelection()
              }}
              onClick={() => setEmojiOpen(true)}
            />,
            '用于给评论补充表情',
          )}
        </Popover>
        <Popover
          open={mentionOpen}
          onOpenChange={setMentionOpen}
          trigger="click"
          placement="topLeft"
          overlayClassName="task-rich-input-overlay task-rich-input-mention-overlay"
          getPopupContainer={getOverlayPopupContainer}
          content={
            <div className="task-rich-input-mention-panel">
              <Text strong>选择人员</Text>
              <Select
                size="small"
                autoFocus
                showSearch
                filterOption={false}
                placeholder="搜索并选择"
                value={undefined}
                onSearch={setMentionSearch}
                onChange={(nextValue: string) => handleSelectMention(nextValue)}
                options={mentionUsers.map((user) => ({
                  value: user.id,
                  label: user.name,
                }))}
                getPopupContainer={getOverlayPopupContainer}
                style={{ width: '100%' }}
              />
            </div>
          }
        >
          {renderToolbarTooltip(
            '@ 提及：选择任务成员',
            <Button
              type="text"
              size="small"
              className="task-rich-input-tool-btn"
              icon={<MentionOutlined />}
              aria-label="@ 提及"
              onMouseDown={(event) => {
                event.preventDefault()
                saveSelection()
              }}
              onClick={() => {
                setMentionOpen(true)
                setMentionSearch('')
              }}
            />,
            '在正文中插入 @ 人员',
          )}
        </Popover>
        <Popover
          open={linkOpen}
          onOpenChange={setLinkOpen}
          trigger="click"
          placement="topLeft"
          overlayClassName="task-rich-input-overlay task-rich-input-link-overlay"
          getPopupContainer={getOverlayPopupContainer}
          content={
            <div className="task-rich-input-link-popover">
              <Text strong>插入链接</Text>
              <Input
                size="small"
                placeholder="输入文本"
                value={linkLabel}
                onChange={(event) => setLinkLabel(event.target.value)}
              />
              <Input
                size="small"
                placeholder="粘贴或输入一个链接"
                value={linkHref}
                onChange={(event) => setLinkHref(event.target.value)}
                onPressEnter={handleLinkConfirm}
              />
              <Space size={8} className="task-rich-input-link-actions">
                <Button size="small" onClick={() => setLinkOpen(false)}>
                  取消
                </Button>
                <Button size="small" type="primary" onClick={handleLinkConfirm}>
                  确定
                </Button>
              </Space>
            </div>
          }
        >
          {renderToolbarTooltip(
            '插入链接：添加网页地址',
            <Button
              type="text"
              size="small"
              className="task-rich-input-tool-btn"
              icon={<LinkOutlined />}
              aria-label="插入链接"
              onMouseDown={(event) => {
                event.preventDefault()
                saveSelection()
                setLinkLabel(selectionRef.current?.toString().trim() ?? '')
              }}
              onClick={() => setLinkOpen(true)}
            />,
            '可以给选中的文字绑定链接',
          )}
        </Popover>
        {renderToolbarTooltip(
          '添加图片：上传或粘贴图片',
          <Upload
            multiple
            showUploadList={false}
            accept="image/*"
            disabled={disabled || !onRequestAttachmentUpload}
            beforeUpload={(file) => {
              void handleUploadAttachment(file as File)
              return false
            }}
          >
            <Button
              type="text"
              size="small"
              className="task-rich-input-tool-btn"
              icon={<PictureOutlined />}
              aria-label="添加图片"
              disabled={disabled || !onRequestAttachmentUpload}
              loading={attachmentUploading}
            />
          </Upload>,
          '图片会按当前输入场景插入或作为评论附件',
        )}
        {mode !== 'description' && (
          renderToolbarTooltip(
            '添加评论附件：上传文件',
            <Upload
              multiple
              showUploadList={false}
              disabled={disabled || !onRequestAttachmentUpload}
              beforeUpload={(file) => {
                void handleUploadAttachment(file as File)
                return false
              }}
            >
              <Button
                type="text"
                size="small"
                className="task-rich-input-tool-btn"
                icon={<PaperClipOutlined />}
                aria-label="添加评论附件"
                disabled={disabled || !onRequestAttachmentUpload}
                loading={attachmentUploading}
              />
            </Upload>,
            '把文件附加到当前评论',
          )
        )}
      </div>
      {(mode === 'comment' || mode === 'comment-edit') && (
        <>
          <span className="task-rich-input-toolbar-divider" />
          {renderToolbarTooltip(
            '发送评论：提交当前内容',
            <Button
              type="text"
              size="small"
              className="task-rich-input-submit-btn"
              icon={<SendOutlined />}
              aria-label="发送评论"
              disabled={disabled || isRichContentEmpty(editorHtmlRef.current, attachments.length)}
              onClick={() => void onSubmit?.(editorHtmlRef.current, currentMentionIdsRef.current)}
            >
              {submitLabel}
            </Button>,
            '按 Enter 发送，Shift+Enter 用于换行',
          )}
        </>
      )}
    </div>
  )

  return (
    <div
      ref={wrapperRef}
      className={className ? `task-rich-input ${className}` : 'task-rich-input'}
      onBlurCapture={handleRootBlur}
    >
      <div className="task-rich-input-shell">
        <div
          ref={editorRef}
          className="task-rich-input-editor"
          contentEditable={!disabled}
          suppressContentEditableWarning
          data-placeholder={placeholder}
          role="textbox"
          aria-multiline="true"
          onFocus={handleEditorFocus}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
          }}
          onInput={syncFromEditor}
          onClick={handleEditorClick}
          onPaste={handlePaste}
          onKeyDown={handleEditorKeyDown}
        />
      </div>
      {renderToolbar()}
      {attachments.length > 0 && (
        <div className="detail-attachment-list task-rich-input-attachment-list">
          {attachments.map((attachment) => renderAttachmentItem(attachment))}
        </div>
      )}
    </div>
  )
}
