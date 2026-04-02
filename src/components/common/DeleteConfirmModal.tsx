import styles from './DeleteConfirmModal.module.less'

type DeleteConfirmModalProps = {
  open: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({
  open,
  title,
  description,
  confirmText = '确认删除',
  cancelText = '取消',
  loading = false,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.title}>{title}</div>
        <div className={styles.description}>{description}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button type="button" className={styles.primary} onClick={onConfirm} disabled={loading}>
            {loading ? '删除中...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
