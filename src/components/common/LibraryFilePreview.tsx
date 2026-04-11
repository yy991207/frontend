import { CloseOutlined, DownloadOutlined, ExpandOutlined } from '@ant-design/icons'
import styles from './LibraryFilePreview.module.less'

export type LibraryFileDetail = {
  file_id: string
  file_name: string
  agent_name: string
  session_id: string
  file_type: string
  file_path: string
  created_at: string
  file_url: string
  skill_name?: string
}

type LibraryFilePreviewProps = {
  visible: boolean
  file: LibraryFileDetail | null
  loading: boolean
  onClose: () => void
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLocaleLowerCase() || ''
}

function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)
}

function isMarkdownFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['md', 'markdown'].includes(ext)
}

function isHtmlFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['html', 'htm'].includes(ext)
}

function isPdfFile(filename: string): boolean {
  return getFileExtension(filename) === 'pdf'
}

function isVideoFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)
}

function isAudioFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(ext)
}

function isCodeFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'css', 'scss', 'less', 'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bash'].includes(ext)
}

export default function LibraryFilePreview({ visible, file, loading, onClose }: LibraryFilePreviewProps) {
  if (!visible) return null

  const handleDownload = () => {
    if (file?.file_url) {
      window.open(file.file_url, '_blank')
    }
  }

  const handleOpenInNewTab = () => {
    if (file?.file_url) {
      window.open(file.file_url, '_blank')
    }
  }

  const renderPreview = () => {
    if (!file) return null

    const { file_name, file_url, file_type } = file

    if (loading) {
      return (
        <div className={styles.loadingState}>
          <span>加载中...</span>
        </div>
      )
    }

    if (isImageFile(file_name)) {
      return (
        <div className={styles.imageWrap}>
          <img src={file_url} alt={file_name} className={styles.previewImage} />
        </div>
      )
    }

    if (file_type === 'image') {
      return (
        <div className={styles.imageWrap}>
          <img src={file_url} alt={file_name} className={styles.previewImage} />
        </div>
      )
    }

    if (isVideoFile(file_name) || file_type === 'video') {
      return (
        <div className={styles.videoWrap}>
          <video src={file_url} controls className={styles.previewVideo} />
        </div>
      )
    }

    if (isAudioFile(file_name) || file_type === 'audio') {
      return (
        <div className={styles.audioWrap}>
          <audio src={file_url} controls className={styles.previewAudio} />
        </div>
      )
    }

    if (isPdfFile(file_name)) {
      return (
        <div className={styles.iframeWrap}>
          <iframe src={file_url} className={styles.previewIframe} title="PDF preview" />
        </div>
      )
    }

    if (isHtmlFile(file_name)) {
      return (
        <div className={styles.iframeWrap}>
          <iframe src={file_url} className={styles.previewIframe} title="HTML preview" sandbox="allow-scripts allow-same-origin" />
        </div>
      )
    }

    if (isMarkdownFile(file_name)) {
      return (
        <div className={styles.markdownWrap}>
          <div className={styles.markdownHint}>
            <span>Markdown 文件请下载后查看，或在新标签页打开源文件</span>
          </div>
        </div>
      )
    }

    if (isCodeFile(file_name)) {
      return (
        <div className={styles.codeWrap}>
          <div className={styles.codeHint}>
            <span>代码文件请下载后查看</span>
          </div>
        </div>
      )
    }

    return (
      <div className={styles.fallbackWrap}>
        <iframe src={file_url} className={styles.previewIframe} title="File preview" sandbox="allow-scripts allow-same-origin" />
      </div>
    )
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <h3 className={styles.fileName}>{file?.file_name || '文件预览'}</h3>
            {file?.skill_name && (
              <span className={styles.skillTag}>{file.skill_name}</span>
            )}
          </div>
          <div className={styles.headerRight}>
            <button type="button" className={styles.headerButton} onClick={handleOpenInNewTab} title="新窗口打开">
              <ExpandOutlined />
            </button>
            <button type="button" className={styles.headerButton} onClick={handleDownload} title="下载">
              <DownloadOutlined />
            </button>
            <button type="button" className={styles.headerButton} onClick={onClose} title="关闭">
              <CloseOutlined />
            </button>
          </div>
        </div>

        <div className={styles.modalBody}>
          {renderPreview()}
        </div>

        {file && (
          <div className={styles.modalFooter}>
            <div className={styles.footerInfo}>
              <span className={styles.footerLabel}>来源:</span>
              <span className={styles.footerValue}>{file.agent_name}</span>
            </div>
            <div className={styles.footerInfo}>
              <span className={styles.footerLabel}>时间:</span>
              <span className={styles.footerValue}>{file.created_at}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}