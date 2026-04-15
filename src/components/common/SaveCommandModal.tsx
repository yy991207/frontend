import { useCallback, useEffect, useState } from 'react'
import { Input, Spin, message } from 'antd'
import styles from './SaveCommandModal.module.less'
import {
  generateCommandFromSession,
  createCommand,
  type CreateCommandRequest,
} from '../../services/commandsService'

const { TextArea } = Input

type SaveCommandModalProps = {
  open: boolean
  sessionId: string
  userId: string
  onClose: () => void
  onSuccess: () => void
}

type ModalPhase = 'loading' | 'editing'

export function SaveCommandModal({ open, sessionId, userId, onClose, onSuccess }: SaveCommandModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('loading')
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('')
  const [attachments, setAttachments] = useState<unknown[]>([])
  const [sourceSessionId, setSourceSessionId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !sessionId) return

    let cancelled = false
    setPhase('loading')
    setName('')
    setTemplate('')
    setAttachments([])
    setSourceSessionId('')

    generateCommandFromSession(sessionId, userId)
      .then((data) => {
        if (cancelled) return
        setName(data.name)
        setTemplate(data.template)
        setAttachments(data.attachments)
        setSourceSessionId(data.source_session_id)
        setPhase('editing')
      })
      .catch((error) => {
        if (cancelled) return
        message.error(error instanceof Error ? error.message : '生成指令模板失败')
        onClose()
      })

    return () => {
      cancelled = true
    }
  }, [open, sessionId])

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      message.error('指令名称不能为空')
      return
    }
    if (!template.trim()) {
      message.error('指令内容不能为空')
      return
    }

    try {
      setSaving(true)
      const payload: CreateCommandRequest = {
        name: name.trim(),
        template: template.trim(),
        attachments,
        source_session_id: sourceSessionId,
      }
      await createCommand(payload, userId)
      onSuccess()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建指令失败')
    } finally {
      setSaving(false)
    }
  }, [name, template, attachments, sourceSessionId, onSuccess])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  if (!open) {
    return null
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        {phase === 'loading' ? (
          <div className={styles.loadingContent}>
            <div className={styles.illustration} />
            <div className={styles.loadingTitle}>正在生成指令模板</div>
            <div className={styles.loadingSubtitle}>
              AI 正在分析当前会话内容，提取关键指令...
            </div>
            <Spin size="large" className={styles.loadingSpinner} />
          </div>
        ) : (
          <>
            <div className={styles.editHeader}>
              <h3 className={styles.editTitle}>保存为指令模板</h3>
              <p className={styles.editDescription}>
                系统已根据当前会话内容生成指令模板，你可以修改名称和指令内容后保存。
              </p>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                指令名称 <span className={styles.required}>*</span>
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="请输入指令名称"
                maxLength={50}
                showCount
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                指令内容 <span className={styles.required}>*</span>
              </label>
              <TextArea
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                placeholder="请输入指令内容"
                rows={6}
                maxLength={2000}
                showCount
              />
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={handleClose}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
