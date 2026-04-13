import { useState, useRef, useCallback, useEffect } from 'react'
import styles from './SkillTemplateInput.module.less'

type SkillTemplateInputProps = {
  value: string
  onChange: (value: string) => void
  onSend?: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
  maxRows?: number
  minRows?: number
}

type Segment = { type: 'text' | 'skill' | 'placeholder'; text: string }

const PLACEHOLDER_RE = /\/[\w\u4e00-\u9fa5-]+/g

function parseSegments(text: string): Segment[] {
  const result: Segment[] = []
  const matches = [...text.matchAll(PLACEHOLDER_RE)]

  if (matches.length === 0) {
    if (text) result.push({ type: 'text', text })
    return result
  }

  let lastIndex = 0

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (m.index === undefined) continue

    if (m.index > lastIndex) {
      result.push({ type: 'text', text: text.slice(lastIndex, m.index) })
    }

    const tagType: Segment['type'] = i === 0 ? 'skill' : 'placeholder'
    result.push({ type: tagType, text: m[0] })
    lastIndex = m.index + m[0].length
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return result
}

export default function SkillTemplateInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  className,
  maxRows = 8,
  minRows = 1,
}: SkillTemplateInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const segments = parseSegments(value)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const newHeight = Math.min(ta.scrollHeight, maxRows * 24 + 16)
    ta.style.height = newHeight + 'px'
  }, [value, maxRows])

  // Sync scroll
  const handleTextareaScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const handleEditStart = useCallback((index: number, text: string) => {
    setEditingIndex(index)
    setEditValue(text)
  }, [])

  const handleEditCancel = useCallback(() => {
    setEditingIndex(null)
    setEditValue('')
  }, [])

  const handleEditConfirm = useCallback(
    (index: number, newValue: string) => {
      const seg = segments[index]
      if (!seg) return

      // Preserve the / prefix for placeholders and skill names
      const prefix = seg.text.startsWith('/') ? '/' : ''
      const cleanValue = newValue.startsWith('/') ? newValue.slice(1) : newValue
      const finalValue = prefix + cleanValue

      // Build new value by replacing this segment
      let newText = ''
      for (let i = 0; i < segments.length; i++) {
        newText += i === index ? finalValue : segments[i].text
      }

      onChange(newText)
      setEditingIndex(null)
      setEditValue('')

      // Refocus textarea
      requestAnimationFrame(() => textareaRef.current?.focus())
    },
    [segments, onChange],
  )

  const handleDeleteSkill = useCallback(() => {
    const newText = value.replace(PLACEHOLDER_RE, '').trimStart()
    onChange(newText)
  }, [value, onChange])

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSend?.()
      }
    },
    [onSend],
  )

  const hasContent = value.trim().length > 0

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleTextareaScroll}
        onKeyDown={handleTextareaKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={minRows}
      />
      <div
        ref={overlayRef}
        className={styles.overlay}
        style={{ display: hasContent ? 'block' : 'none' }}
      >
        {segments.map((seg, index) => {
          // Skill tag — non-editable, only deletable
          if (seg.type === 'skill' && !disabled) {
            return (
              <span
                key={index}
                className={styles.skillTag}
              >
                <span className={styles.skillTagText}>{seg.text}</span>
                <span
                  className={styles.skillDelete}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteSkill()
                  }}
                >
                  ×
                </span>
              </span>
            )
          }

          // Placeholder tag
          if (seg.type === 'placeholder' && !disabled) {
            if (editingIndex === index) {
              return (
                <span key={index} className={styles.placeholderTagEditing}>
                  <input
                    className={styles.placeholderEditInput}
                    value={editValue}
                    autoFocus
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleEditConfirm(index, editValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleEditConfirm(index, editValue)
                      }
                      if (e.key === 'Escape') handleEditCancel()
                    }}
                  />
                </span>
              )
            }
            return (
              <span
                key={index}
                className={styles.placeholderTag}
                onClick={() => handleEditStart(index, seg.text)}
              >
                {seg.text}
              </span>
            )
          }

          return <span key={index}>{seg.text}</span>
        })}
      </div>
    </div>
  )
}
