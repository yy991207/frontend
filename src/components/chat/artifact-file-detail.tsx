import {
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  LinkOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { Button, Drawer, message, Segmented, Space } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useArtifacts, type ArtifactFile } from './artifacts-context'
import styles from './artifacts.module.less'
import { loadArtifactContent } from '../../core/artifacts/loader'
import { buildArtifactDownloadUrl } from '../../core/artifacts/utils'
import { checkCodeFile, getFileName } from '../../core/utils/files'
import { MarkdownContent } from './markdown-content'

type ArtifactFileDetailProps = {
  file: ArtifactFile
  onOpenChange?: (open: boolean) => void
}

export function ArtifactFileDetail({ file, onOpenChange }: ArtifactFileDetailProps) {
  const { open, setOpen, files, selectFile } = useArtifacts()
  const isExternalUrl = useMemo(() => {
    return file.filepath.startsWith('http://') || file.filepath.startsWith('https://')
  }, [file.filepath])
  const displayFilename = useMemo(() => {
    if (isExternalUrl) {
      try {
        const url = new URL(file.filepath)
        return url.pathname.split('/').pop() || file.filepath
      } catch {
        return file.filepath
      }
    }
    return getFileName(file.filepath)
  }, [file.filepath, isExternalUrl])

  const { isCodeFile, language } = useMemo(() => {
    if (isExternalUrl) {
      return checkCodeFile(displayFilename)
    }
    return checkCodeFile(file.filepath)
  }, [file.filepath, isExternalUrl, displayFilename])

  const previewable = useMemo(() => {
    return language === 'html' || language === 'markdown'
  }, [language])

  const [viewMode, setViewMode] = useState<'code' | 'preview'>(
    previewable ? 'preview' : 'code',
  )
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (previewable) {
      setViewMode('preview')
    } else {
      setViewMode('code')
    }
  }, [previewable])


  useEffect(() => {
    if (!open || !isCodeFile || isExternalUrl || !file.baseUrl || !file.sessionId) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

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
          message.error('文件内容加载失败')
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
  }, [open, isCodeFile, isExternalUrl, file.filepath, file.sessionId, file.baseUrl])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      message.success('已复制到剪贴板')
    } catch {
      message.error('复制失败')
    }
  }, [content])

  const handleOpenInNewTab = useCallback(() => {
    const url = isExternalUrl ? file.filepath : buildArtifactDownloadUrl({
      baseUrl: file.baseUrl ?? '',
      sessionId: file.sessionId ?? '',
      filepath: file.filepath,
    })
    window.open(url, '_blank')
  }, [file, isExternalUrl])

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

  const previewUrl = isExternalUrl ? file.filepath : buildArtifactDownloadUrl({
    baseUrl: file.baseUrl ?? '',
    sessionId: file.sessionId ?? '',
    filepath: file.filepath,
  })

  return (
    <Drawer
      title={null}
      open={open}
      onClose={handleClose}
      placement="right"
      width="min(720px, 85vw)"
      className={styles.artifactDrawer}
      styles={{ body: { padding: 0 } }}
      closeIcon={null}
    >
      <div className={styles.artifactPanel}>
        <div className={styles.artifactHeader}>
          <div className={styles.artifactHeaderLeft}>
            <div className={styles.artifactTitle}>{displayFilename}</div>
            {files.length > 1 && (
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
                    {f.filepath.startsWith('http') ? (() => {
                      try { return new URL(f.filepath).pathname.split('/').pop() || f.filepath } catch { return f.filepath }
                    })() : getFileName(f.filepath)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className={styles.artifactHeaderCenter}>
            {previewable && !isExternalUrl && (
              <Segmented
                value={viewMode}
                onChange={(val) => setViewMode(val as 'code' | 'preview')}
                options={[
                  { label: '代码', value: 'code', icon: <CodeOutlined /> },
                  { label: '预览', value: 'preview', icon: <EyeOutlined /> },
                ]}
              />
            )}
          </div>
          <div className={styles.artifactHeaderRight}>
            <Space size="small">
              {isCodeFile && (
                <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                  复制
                </Button>
              )}
              <Button type="text" size="small" icon={<LinkOutlined />} onClick={handleOpenInNewTab}>
                新窗口
              </Button>
              <Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleDownload}>
                下载
              </Button>
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleClose} />
            </Space>
          </div>
        </div>

        <div className={styles.artifactBody}>
          {isExternalUrl && language === 'html' && (
            <div className={styles.artifactMarkdownWrap}>
              <iframe
                className={styles.artifactIframe}
                src={previewUrl}
              />
            </div>
          )}

          {isExternalUrl && language !== 'html' && (
            <iframe
              className={styles.artifactIframe}
              src={previewUrl}
            />
          )}

          {previewable && viewMode === 'preview' && language === 'markdown' && !isExternalUrl && (
            <div className={styles.artifactMarkdownWrap}>
              {loading ? (
                <div className={styles.artifactLoading}>加载中...</div>
              ) : (
                <MarkdownContent content={content} isStreaming={false} />
              )}
            </div>
          )}

          {previewable && viewMode === 'preview' && language === 'html' && !isExternalUrl && (
            <iframe
              className={styles.artifactIframe}
              src={previewUrl}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          )}

          {viewMode === 'code' && isCodeFile && !isExternalUrl && (
            <div className={styles.artifactCodeWrap}>
              {loading ? (
                <div className={styles.artifactLoading}>加载中...</div>
              ) : (
                <pre className={styles.artifactCode}>
                  <code>{content}</code>
                </pre>
              )}
            </div>
          )}

          {!isCodeFile && !isExternalUrl && (
            <iframe
              className={styles.artifactIframe}
              src={previewUrl}
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      </div>
    </Drawer>
  )
}
