import { useRef, useCallback, useEffect, useState } from 'react'
import styles from './SkillTemplateInput.module.less'

type SkillTemplateInputProps = {
  value: string
  onChange: (value: string) => void
  onSend?: () => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onMultilineChange?: (isMultiline: boolean) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  maxRows?: number
  minRows?: number
}

type Segment = { type: 'text' | 'placeholder'; text: string }

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
    // 所有 /xxx 都渲染为 placeholder，技能名称由外部的 selectedSkillBadge 显示
    result.push({ type: 'placeholder', text: m[0] })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) {
    result.push({ type: 'text', text: text.slice(lastIndex) })
  }
  return result
}

function getPlainText(el: HTMLElement): string {
  let text = ''
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement
      const inner = child.querySelector('[data-plain]')
      if (inner) text += inner.textContent || ''
      else text += child.textContent || ''
    }
  }
  return text
}

function buildHTML(segments: Segment[]): string {
  if (segments.length === 0) return ''
  return segments
    .map((seg) => {
      if (seg.type === 'text') {
        return `<span data-plain="true">${escapeHTML(seg.text)}</span>`
      }
      // 所有 /xxx 都渲染为 placeholder 标签
      return `<span class="${styles.placeholderTag}" contenteditable="false" data-plain="true"><span class="${styles.placeholderTagText}">${escapeHTML(seg.text)}</span></span>`
    })
    .join('')
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function moveCaretToEnd(el: HTMLElement) {
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

export default function SkillTemplateInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  onMultilineChange,
  disabled,
  placeholder,
  className,
  maxRows = 8,
  minRows = 1,
}: SkillTemplateInputProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isComposing, setIsComposing] = useState(false)
  const skipSyncRef = useRef(false)
  const externalValueRef = useRef(value)

  const reportMultiline = useCallback(() => {
    const el = editorRef.current

    if (!el) {
      onMultilineChange?.(false)
      return
    }

    const text = getPlainText(el)

    if (!text.trim()) {
      onMultilineChange?.(false)
      return
    }

    const lineHeight = Number.parseFloat(window.getComputedStyle(el).lineHeight) || 26
    const isMultiline = text.includes('\n') || el.scrollHeight > lineHeight * 1.5

    onMultilineChange?.(isMultiline)
  }, [onMultilineChange])

  // Sync external value changes into the editor
  useEffect(() => {
    if (skipSyncRef.current) return
    const el = editorRef.current
    if (!el) return

    if (document.activeElement === el) {
      const current = getPlainText(el)
      if (current === value) return
    }

    externalValueRef.current = value
    el.innerHTML = buildHTML(parseSegments(value))
    // 同步完内容后，下一帧再测量真实高度，避免拿到旧的滚动高度。
    requestAnimationFrame(() => {
      moveCaretToEnd(el)
      reportMultiline()
    })
  }, [reportMultiline, value])

  // Initial render
  useEffect(() => {
    const el = editorRef.current
    if (!el || el.innerHTML.trim()) return
    el.innerHTML = buildHTML(parseSegments(value))
    externalValueRef.current = value
    requestAnimationFrame(() => {
      reportMultiline()
    })
  }, [reportMultiline, value])

  useEffect(() => {
    if (!onMultilineChange) {
      return
    }

    const handleResize = () => {
      requestAnimationFrame(() => {
        reportMultiline()
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [onMultilineChange, reportMultiline])

  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const text = getPlainText(el)
    skipSyncRef.current = true
    externalValueRef.current = text
    onChange(text)
    requestAnimationFrame(() => {
      skipSyncRef.current = false
      reportMultiline()
    })
  }, [onChange, reportMultiline])

  const handleInput = useCallback(() => {
    if (isComposing) return
    emitChange()
  }, [isComposing, emitChange])

  const handleCompositionStart = useCallback(() => setIsComposing(true), [])
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false)
    emitChange()
  }, [emitChange])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }, [])

  // Handle click to edit placeholder tags, and skill tag deletion
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement

      // Skill tag delete button
      const deleteBtn = target.closest('[data-skill-delete]')
      if (deleteBtn) {
        e.preventDefault()
        e.stopPropagation()
        const skillTag = deleteBtn.parentElement
        if (skillTag) {
          skillTag.remove()
          emitChange()
        }
        return
      }

      // Placeholder tag editing
      const tag = target.closest(`.${styles.placeholderTag}`) as HTMLSpanElement | null
      if (!tag || tag.contentEditable === 'true' || disabled) return

      const innerSpan = tag.querySelector(`.${styles.placeholderTagText}`) as HTMLSpanElement | null
      if (!innerSpan) return

      // Switch to edit mode
      tag.classList.remove(styles.placeholderTag)
      tag.classList.add(styles.placeholderTagEditing)
      tag.contentEditable = 'true'
      innerSpan.contentEditable = 'true'

      innerSpan.style.cssText =
        'outline:none;border:1.5px solid #245bdb;border-radius:4px;padding:0 4px;background:#fff;color:#1f2329;cursor:text;'
      innerSpan.focus()

      // Select all text
      const range = document.createRange()
      range.selectNodeContents(innerSpan)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)

      tag.setAttribute('data-original-text', innerSpan.textContent || '')

      const finish = () => {
        const rawText = innerSpan.textContent || ''
        const cleanText = rawText.replace(/^\/+/, '')
        innerSpan.textContent = cleanText ? '/' + cleanText : rawText

        innerSpan.style.cssText = ''
        innerSpan.contentEditable = 'inherit'
        tag.contentEditable = 'false'
        tag.classList.remove(styles.placeholderTagEditing)
        tag.classList.add(styles.placeholderTag)
        tag.removeAttribute('data-original-text')

        innerSpan.removeEventListener('blur', finish)
        innerSpan.removeEventListener('keydown', onKey)

        // Fire input to sync value
        emitChange()

        // Move cursor after the tag
        requestAnimationFrame(() => {
          if (tag.parentNode) {
            const r = document.createRange()
            r.setStartAfter(tag)
            r.collapse(true)
            const s = window.getSelection()
            s?.removeAllRanges()
            s?.addRange(r)
          }
        })
      }

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Enter') {
          ev.preventDefault()
          innerSpan.blur()
        }
        if (ev.key === 'Escape') {
          ev.preventDefault()
          innerSpan.textContent = tag.getAttribute('data-original-text') || ''
          innerSpan.blur()
        }
      }

      innerSpan.addEventListener('blur', finish)
      innerSpan.addEventListener('keydown', onKey)
    },
    [disabled, emitChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e)

      if (e.defaultPrevented) {
        return
      }

      // 输入法组合期间不处理快捷键（首次回车选中文字，二次回车才发送）
      if (isComposing || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
        return
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSend?.()
        return
      }

      if (e.key === 'Backspace') {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        if (!range.collapsed) return

        const startNode = range.startContainer
        const startOffset = range.startOffset
        const el = editorRef.current
        if (!el) return

        // Cursor is at start of a text node — check if previous sibling is a skill tag
        if (startNode.nodeType === Node.TEXT_NODE && startOffset === 0) {
          const prev = startNode.previousSibling
          if (prev?.nodeType === Node.ELEMENT_NODE) {
            const prevEl = prev as HTMLElement
            if (prevEl.contentEditable === 'false' && prevEl.classList.contains(styles.skillTag)) {
              e.preventDefault()
              el.removeChild(prevEl)
              emitChange()
              return
            }
          }
        }

        // Cursor is at position 0 of a text node and that text node IS the only child — check if the node itself is right after a tag
        if (startNode.nodeType === Node.ELEMENT_NODE && startOffset === 0) {
          // Cursor is at start of editor
        }
      }
    },
    [onKeyDown, onSend, emitChange],
  )

  return (
    <div
      ref={editorRef}
      className={`${styles.editor} ${className || ''}`}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onClick={handleClick}
      data-placeholder={placeholder}
      style={{
        minHeight: minRows * 24,
        maxHeight: maxRows * 24 + 16,
      }}
    />
  )
}
