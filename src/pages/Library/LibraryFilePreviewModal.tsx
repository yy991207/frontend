import { Modal, message } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchLibraryFileDetail,
  fetchPreviewContent,
  type LibraryFileDetail,
} from '../../services/libraryFileService'
import { checkCodeFile, isImageFile } from '../../core/utils/files'
import { renderMarkdownToHtml, buildMarkdownPreviewHtml } from '../../core/artifacts/markdown-render'
import { parseCourseTableArtifact, buildCourseTablePreviewHtml } from '../../core/artifacts/course-table'
import { FilePreviewRenderer } from '../../components/file-preview/file-preview-renderer'
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

  const isJsonFile = language === 'json'

  const courseTableArtifact = useMemo(() => {
    if (!isJsonFile || !content) return null
    return parseCourseTableArtifact(content)
  }, [content, isJsonFile])

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

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
  }, [content])

  const handleOpenInNewTab = useCallback(() => {
    if (!fileDetail) return

    if (courseTableArtifact) {
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(buildCourseTablePreviewHtml(courseTableArtifact))
        newWindow.document.close()
      }
      return
    }

    if (language === 'markdown' && content) {
      const htmlContent = renderMarkdownToHtml(content)
      const fullHtml = buildMarkdownPreviewHtml(displayFilename, htmlContent)
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(fullHtml)
        newWindow.document.close()
      }
      return
    }

    if (language === 'html' && content) {
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(content)
        newWindow.document.close()
      }
      return
    }

    if (isImage) {
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${displayFilename}</title>
            <style>
              body { margin: 0; padding: 0; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              img { max-width: 90vw; max-height: 90vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${fileDetail.file_url}" alt="${displayFilename}">
          </body>
          </html>
        `)
        newWindow.document.close()
      }
      return
    }

    // Fallback: open file URL directly
    window.open(fileDetail.file_url, '_blank')
  }, [fileDetail, content, language, courseTableArtifact, displayFilename, isImage])

  const handleDownload = useCallback(() => {
    if (!fileDetail) return
    window.open(fileDetail.file_url, '_blank')
  }, [fileDetail])

  return (
    <Modal
      open={visible}
      title={null}
      closeIcon={null}
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
      <FilePreviewRenderer
        content={content}
        language={language}
        fileName={displayFilename}
        isImage={isImage}
        isCodeFile={isCodeFile}
        previewable={previewable}
        courseTable={courseTableArtifact}
        loading={loading && !fileDetail}
        imageUrl={isImage ? fileDetail?.file_url : undefined}
        onCopy={handleCopy}
        onOpenInNewTab={handleOpenInNewTab}
        onDownload={handleDownload}
        onClose={handleCancel}
      />
    </Modal>
  )
}
