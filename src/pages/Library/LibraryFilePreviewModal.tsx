import { Modal, Spin, message } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchLibraryFileDetail,
  fetchPreviewContent,
  type LibraryFileDetail,
} from '../../services/libraryFileService'
import { checkCodeFile, isImageFile } from '../../core/utils/files'
import { renderMarkdownToHtml, buildMarkdownPreviewHtml } from '../../core/artifacts/markdown-render'
import styles from './library-preview.module.less'

type LibraryFilePreviewModalProps = {
  visible: boolean
  fileId: string | null
  baseUrl: string
  onClose: () => void
}

function getFileDisplayName(filename: string): string {
  try {
    return decodeURIComponent(filename)
  } catch {
    return filename
  }
}

export function LibraryFilePreviewModal({
  visible,
  fileId,
  baseUrl,
  onClose,
}: LibraryFilePreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [fileDetail, setFileDetail] = useState<LibraryFileDetail | null>(null)
  const [content, setContent] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)

  const displayFilename = useMemo(() => {
    return fileDetail ? getFileDisplayName(fileDetail.file_name) : ''
  }, [fileDetail])

  const { isCodeFile, language } = useMemo(() => {
    if (!fileDetail) return { isCodeFile: false, language: null }
    return checkCodeFile(fileDetail.file_name)
  }, [fileDetail])

  const isImage = useMemo(() => {
    if (!fileDetail) return false
    return isImageFile(fileDetail.file_name) || fileDetail.file_type === 'image'
  }, [fileDetail])

  const previewable = useMemo(() => {
    return language === 'html' || language === 'markdown'
  }, [language])

  useEffect(() => {
    if (!visible || !fileId) {
      setFileDetail(null)
      setContent('')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)

    fetchLibraryFileDetail(baseUrl, fileId, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) {
          setFileDetail(detail)
          if (isImageFile(detail.file_name) || detail.file_type === 'image') {
            return
          }
          return fetchPreviewContent(baseUrl, detail.file_url, controller.signal)
        }
      })
      .then((text) => {
        if (!controller.signal.aborted && text) {
          setContent(text)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          message.error('文件加载失败')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [visible, fileId, baseUrl])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    onClose()
  }, [onClose])

  const renderContent = useMemo(() => {
    if (loading) {
      return (
        <div className={styles.previewLoading}>
          <Spin size="large" />
        </div>
      )
    }

    if (!fileDetail) {
      return null
    }

    if (isImage) {
      return (
        <div className={styles.previewImageWrap}>
          <img
            className={styles.previewImage}
            src={fileDetail.file_url}
            alt={displayFilename}
          />
        </div>
      )
    }

    if (previewable && language === 'html' && content) {
      return (
        <div className={styles.previewIframeWrap}>
          <iframe
            className={styles.previewIframe}
            srcDoc={content}
            sandbox="allow-scripts allow-same-origin allow-forms"
            title="HTML Preview"
          />
        </div>
      )
    }

    if (previewable && language === 'markdown' && content) {
      const htmlContent = renderMarkdownToHtml(content)
      const fullHtml = buildMarkdownPreviewHtml(displayFilename, htmlContent, true)
      return (
        <div className={styles.previewIframeWrap}>
          <iframe
            className={styles.previewIframe}
            srcDoc={fullHtml}
            sandbox="allow-same-origin"
            title="Markdown Preview"
          />
        </div>
      )
    }

    if (isCodeFile && content) {
      return (
        <div className={styles.previewCodeWrap}>
          <pre className={styles.previewCode}>
            <code>{content}</code>
          </pre>
        </div>
      )
    }

    if (content) {
      return (
        <div className={styles.previewCodeWrap}>
          <pre className={styles.previewCode}>
            <code>{content}</code>
          </pre>
        </div>
      )
    }

    return (
      <div className={styles.previewEmpty}>
        无法预览此文件类型
      </div>
    )
  }, [loading, fileDetail, isImage, previewable, language, content, isCodeFile, displayFilename])

  return (
    <Modal
      open={visible}
      title={displayFilename || '文件预览'}
      onCancel={handleCancel}
      footer={null}
      width={800}
      centered
      className={styles.previewModal}
      styles={{
        body: {
          height: 600,
          overflow: 'hidden',
          padding: 0,
        },
      }}
    >
      {renderContent}
    </Modal>
  )
}