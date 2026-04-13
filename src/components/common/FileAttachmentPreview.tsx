import { CloseOutlined, LoadingOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { UploadedFile } from '../../services/ossUploadService'
import { getFileTypeIcon, formatFileSize } from '../../services/ossUploadService'
import styles from './FileAttachmentPreview.module.less'

type FileAttachmentPreviewProps = {
  files: UploadedFile[]
  onRemove: (fileId: string) => void
}

export function FileAttachmentPreview({ files, onRemove }: FileAttachmentPreviewProps) {
  if (files.length === 0) return null

  return (
    <div className={styles.container}>
      {files.map((file) => (
        <div key={file.id} className={`${styles.fileItem} ${file.status === 'error' ? styles.fileItemError : ''}`}>
          <div className={styles.fileIcon}>
            {file.status === 'uploading' ? (
              <LoadingOutlined className={styles.loadingIcon} />
            ) : file.status === 'error' ? (
              <CloseCircleOutlined className={styles.errorIcon} />
            ) : (
              <span className={styles.iconText}>{getFileTypeIcon(file.ext)}</span>
            )}
          </div>
          <div className={styles.fileInfo}>
            <div className={styles.fileName} title={file.name}>{file.name}</div>
            <div className={styles.fileMeta}>
              {file.status === 'uploading' && (
                <span className={styles.fileProgress}>{file.uploadProgress}%</span>
              )}
              {file.status === 'error' && (
                <span className={styles.fileStatusError}>{file.error || '上传失败'}</span>
              )}
              {file.status !== 'uploading' && file.status !== 'error' && (
                <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
              )}
              {file.status === 'uploading' && (
                <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => onRemove(file.id)}
            aria-label="移除文件"
          >
            <CloseOutlined />
          </button>
        </div>
      ))}
    </div>
  )
}