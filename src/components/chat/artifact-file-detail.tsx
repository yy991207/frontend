import { useCallback, useEffect, useMemo, useState } from 'react'

import { useArtifacts, type ArtifactFile } from './artifacts-context'
import styles from './artifacts.module.less'
import { FilePreviewRenderer } from '../file-preview/file-preview-renderer'
import { loadArtifactContent, loadPreviewContent } from '../../core/artifacts/loader'
import { parseCourseTableArtifact, buildCourseTablePreviewHtml } from '../../core/artifacts/course-table'
import { buildArtifactDownloadUrl } from '../../core/artifacts/utils'
import { buildMarkdownPreviewHtml, renderMarkdownToHtml } from '../../core/artifacts/markdown-render'
import { checkCodeFile, getFileName, isImageFile } from '../../core/utils/files'

type ArtifactFileDetailProps = {
  file: ArtifactFile
  onOpenChange?: (open: boolean) => void
}

export function ArtifactFileDetail({ file, onOpenChange }: ArtifactFileDetailProps) {
  const { setOpen, files, selectFile } = useArtifacts()
  const isExternalUrl = useMemo(() => {
    return file.filepath.startsWith('http://') || file.filepath.startsWith('https://')
  }, [file.filepath])
  const displayFilename = useMemo(() => {
    return getArtifactDisplayName(file.filepath)
  }, [file.filepath, isExternalUrl])

  const { isCodeFile, language } = useMemo(() => {
    if (isExternalUrl) {
      return checkCodeFile(displayFilename)
    }
    return checkCodeFile(file.filepath)
  }, [file.filepath, isExternalUrl, displayFilename])

  const isImage = useMemo(() => {
    if (isExternalUrl) {
      return isImageFile(displayFilename)
    }
    return isImageFile(file.filepath)
  }, [file.filepath, isExternalUrl, displayFilename])

  const previewable = useMemo(() => {
    return language === 'html' || language === 'markdown'
  }, [language])
  const isJsonFile = language === 'json'

  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // External URL content loading
  useEffect(() => {
    if (!isExternalUrl) return

    const controller = new AbortController()
    setLoading(true)

    const previewUrl = file.originalUrl ?? file.filepath
    const request = file.baseUrl && file.sessionId
      ? loadPreviewContent({
          baseUrl: file.baseUrl,
          sessionId: file.sessionId,
          url: previewUrl,
          signal: controller.signal,
        })
      : Promise.resolve('')

    request
      .then((text) => {
        if (!controller.signal.aborted) {
          setContent(text)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          // Error already handled in loadPreviewContent
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
  }, [isExternalUrl, file.filepath, file.originalUrl, file.sessionId, file.baseUrl])

  // Internal URL content loading
  useEffect(() => {
    if (!isCodeFile || isExternalUrl || !file.baseUrl || !file.sessionId) return

    const controller = new AbortController()
    setLoading(true)
    loadArtifactContent({
      baseUrl: file.baseUrl,
      sessionId: file.sessionId,
      filepath: file.filepath,
      signal: controller.signal,
    })
      .then((text) => {
        if (!controller.signal.aborted) {
          setContent(text)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          // Error already handled in loadArtifactContent
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
  }, [isCodeFile, isExternalUrl, file.filepath, file.sessionId, file.baseUrl])

  const courseTableArtifact = useMemo(() => {
    if (!isJsonFile || !content) {
      return null
    }

    return parseCourseTableArtifact(content)
  }, [content, isJsonFile])

  const handleOpenInNewTab = useCallback(() => {
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
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(buildMarkdownPreviewHtml(displayFilename, content ? renderMarkdownToHtml(content) : ''))
        newWindow.document.close()
      }
      return
    }

    if (isExternalUrl && content && language === 'html') {
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(content)
        newWindow.document.close()
      }
      return
    }

    if (isImage) {
      const imgUrl = isExternalUrl ? file.filepath : buildArtifactDownloadUrl({
        baseUrl: file.baseUrl ?? '',
        sessionId: file.sessionId ?? '',
        filepath: file.filepath,
      })
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
            <img src="${imgUrl}" alt="${displayFilename}">
          </body>
          </html>
        `)
        newWindow.document.close()
      }
      return
    }

    const url = isExternalUrl ? file.filepath : buildArtifactDownloadUrl({
      baseUrl: file.baseUrl ?? '',
      sessionId: file.sessionId ?? '',
      filepath: file.filepath,
    })
    window.open(url, '_blank')
  }, [file, isExternalUrl, content, language, courseTableArtifact, displayFilename, isImage])

  const handleDownload = useCallback(() => {
    const url = isExternalUrl ? file.filepath : buildArtifactDownloadUrl({
      baseUrl: file.baseUrl ?? '',
      sessionId: file.sessionId ?? '',
      filepath: file.filepath,
      download: true,
    })
    window.open(url, '_blank')
  }, [file, isExternalUrl])

  const handleClose = useCallback(() => {
    setOpen(false)
    onOpenChange?.(false)
  }, [setOpen, onOpenChange])

  const previewUrl = isExternalUrl ? '' : buildArtifactDownloadUrl({
    baseUrl: file.baseUrl ?? '',
    sessionId: file.sessionId ?? '',
    filepath: file.filepath,
  })

  return (
    <div className={styles.artifactPanel}>
      {/* Multi-file selector (Chat-specific) */}
      {files.length > 1 && (
        <div style={{ padding: '8px 18px', borderBottom: '1px solid rgba(15, 23, 42, 0.06)' }}>
          <select
            className={styles.artifactFileSelect}
            value={file.filepath}
            onChange={(e) => {
              const found = files.find((f) => f.filepath === e.target.value)
              if (found) selectFile(found)
            }}
          >
            {files.map((f) => (
              <option key={f.filepath} value={f.filepath}>
                {getArtifactDisplayName(f.filepath)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Shared renderer */}
      <FilePreviewRenderer
        content={content}
        language={language}
        fileName={displayFilename}
        isImage={isImage}
        isCodeFile={isCodeFile}
        previewable={previewable}
        courseTable={courseTableArtifact}
        loading={loading}
        imageUrl={isExternalUrl ? '' : previewUrl}
        onCopy={async () => {
          await navigator.clipboard.writeText(content)
        }}
        onOpenInNewTab={handleOpenInNewTab}
        onDownload={handleDownload}
        onClose={handleClose}
      />
    </div>
  )
}

function getArtifactDisplayName(filepath: string): string {
  if (filepath.startsWith('http://') || filepath.startsWith('https://')) {
    try {
      const url = new URL(filepath)
      const rawName = url.pathname.split('/').pop() || filepath
      return decodeURIComponent(rawName)
    } catch {
      return filepath
    }
  }

  return getFileName(filepath)
}
