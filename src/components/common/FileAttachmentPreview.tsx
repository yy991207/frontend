import { CloseOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { UploadedFile } from '../../services/ossUploadService'
import { getFileTypeIcon, getFileTypeName, formatFileSize } from '../../services/ossUploadService'
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
            ) : file.status === 'completed' ? (
              <span className={styles.iconText}>{getFileTypeIcon(file.ext)}</span>
            ) : file.status === 'error' ? (
              <CloseCircleOutlined className={styles.errorIcon} />
            ) : (
              <span className={styles.iconText}>{getFileTypeIcon(file.ext)}</span>
            )}
          </div>
          <div className={styles.fileInfo}>
            <div className={styles.fileName}>{file.name}</div>
            <div className={styles.fileMeta}>
              <span className={styles.fileType}>{getFileTypeName(file.ext)}</span>
              <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
              {file.status === 'uploading' && (
                <span className={styles.fileProgress}>{file.uploadProgress}%</span>
              )}
              {file.status === 'completed' && (
                <span className={styles.fileStatusSuccess}>
                  <CheckCircleOutlined /> 已添加
                </span>
              )}
              {file.status === 'error' && (
                <span className={styles.fileStatusError}>{file.error || '上传失败'}</span>
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