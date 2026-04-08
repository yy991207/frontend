import { useState, useEffect, useRef } from 'react'
import { Input } from 'antd'
import type { InputRef } from 'antd'
import { CloseOutlined, EditOutlined } from '@ant-design/icons'
import styles from './EditAgentModal.module.less'

interface EditAgentModalProps {
  visible: boolean
  name: string
  description: string
  avatar: string
  onCancel: () => void
  onSave: (data: { name: string; description: string }) => void
}

const MAX_NAME_LENGTH = 20
const MAX_DESC_LENGTH = 100

export default function EditAgentModal({
  visible,
  name,
  description,
  avatar,
  onCancel,
  onSave,
}: EditAgentModalProps) {
  const [editName, setEditName] = useState(name)
  const [editDesc, setEditDesc] = useState(description)
  const nameInputRef = useRef<InputRef>(null)

  useEffect(() => {
    if (visible) {
      setEditName(name)
      setEditDesc(description)
      document.body.style.overflow = 'hidden'
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [visible, name, description])

  const handleSave = () => {
    if (!editName.trim()) {
      return
    }
    onSave({
      name: editName.trim(),
      description: editDesc.trim(),
    })
  }

  const handleClose = () => {
    onCancel()
  }

  if (!visible) {
    return null
  }

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>编辑基本信息</h3>
          <button className={styles.closeButton} onClick={handleClose}>
            <CloseOutlined />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrap}>
              <img className={styles.avatar} src={avatar} alt="avatar" />
              <div className={styles.avatarEditBtn}>
                <EditOutlined />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.formItem}>
              <label className={styles.formLabel}>
                智能体名称 <span className={styles.required}>*</span>
              </label>
              <div className={styles.inputWithCount}>
                <Input
                  ref={nameInputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  className={styles.nameInput}
                />
                <span className={styles.charCount}>
                  {editName.length}/{MAX_NAME_LENGTH}
                </span>
              </div>
            </div>

            <div className={styles.formItem}>
              <label className={styles.formLabel}>描述</label>
              <div className={styles.textareaWithCount}>
                <Input.TextArea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={MAX_DESC_LENGTH}
                  autoSize={{ minRows: 4, maxRows: 6 }}
                  className={styles.descTextarea}
                />
                <span className={styles.charCount}>
                  {editDesc.length}/{MAX_DESC_LENGTH}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={handleClose}>
            取消
          </button>
          <button
            className={`${styles.saveButton} ${editName.trim() ? styles.saveButtonActive : ''}`}
            onClick={handleSave}
            disabled={!editName.trim()}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
