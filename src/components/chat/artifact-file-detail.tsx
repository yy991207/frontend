import {
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  LinkOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { Button, message, Segmented } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useArtifacts, type ArtifactFile } from './artifacts-context'
import styles from './artifacts.module.less'
import { loadArtifactContent, loadPreviewContent } from '../../core/artifacts/loader'
import { buildCourseTablePreviewHtml, parseCourseTableArtifact } from '../../core/artifacts/course-table'
import { buildArtifactDownloadUrl } from '../../core/artifacts/utils'
import { checkCodeFile, getFileName } from '../../core/utils/files'
import { MarkdownContent } from './markdown-content'

type ArtifactFileDetailProps = {
  file: ArtifactFile
  onOpenChange?: (open: boolean) => void
}

function formatDuration(duration: number): string {
  return `${duration.toFixed(1)} 分钟`
}

function getArtifactDisplayName(filepath: string): string {
  if (filepath.startsWith('http://') || filepath.startsWith('https://')) {
    try {
      const url = new URL(filepath)
      return url.pathname.split('/').pop() || filepath
    } catch {
      return filepath
    }
  }

  return getFileName(filepath)
}

function CourseTablePreview({ courseTable }: { courseTable: NonNullable<ReturnType<typeof parseCourseTableArtifact>> }) {
  return (
    <div className={styles.courseTableWrap}>
      <div className={styles.courseTableHero}>
        <div className={styles.courseTableEyebrow}>课程表</div>
        <h2 className={styles.courseTableTitle}>{courseTable.query}主题课程安排</h2>
        <p className={styles.courseTableSummary}>
          共 {courseTable.courses.length} 门课程，总时长 {formatDuration(courseTable.total_duration)}
        </p>
      </div>

      <div className={styles.courseTableStats}>
        <div className={styles.courseTableStatCard}>
          <span className={styles.courseTableStatLabel}>课程数量</span>
          <strong className={styles.courseTableStatValue}>{courseTable.courses.length}</strong>
        </div>
        <div className={styles.courseTableStatCard}>
          <span className={styles.courseTableStatLabel}>总时长</span>
          <strong className={styles.courseTableStatValue}>{formatDuration(courseTable.total_duration)}</strong>
        </div>
      </div>

      <div className={styles.courseTableList}>
        {courseTable.courses.map((course, index) => (
          <article key={course.resource_id} className={styles.courseTableItem}>
            <div className={styles.courseTableItemIndex}>{index + 1}</div>
            <div className={styles.courseTableItemBody}>
              <h3 className={styles.courseTableItemTitle}>{course.title}</h3>
              <div className={styles.courseTableItemMeta}>
                <span>时长：{formatDuration(course.duration)}</span>
                <span>资源 ID：{course.resource_id}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
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

  const previewable = useMemo(() => {
    return language === 'html' || language === 'markdown'
  }, [language])
  const isJsonFile = language === 'json'

  const [viewMode, setViewMode] = useState<'code' | 'preview'>(
    previewable ? 'preview' : 'code',
  )
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const courseTableArtifact = useMemo(() => {
    if (!isJsonFile || !content) {
      return null
    }

    return parseCourseTableArtifact(content)
  }, [content, isJsonFile])

  const hasStructuredPreview = courseTableArtifact !== null

  useEffect(() => {
    if (previewable || hasStructuredPreview) {
      setViewMode('preview')
    } else {
      setViewMode('code')
    }
  }, [hasStructuredPreview, previewable])

  // 外部文件统一走 preview API 代理取源码，既能绕开 OSS 跨域限制，也能把 json 原文交给前端做结构化渲染。
  useEffect(() => {
    if (!isExternalUrl) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

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
  }, [isExternalUrl, isJsonFile, file.filepath, file.originalUrl, file.sessionId, file.baseUrl])

  useEffect(() => {
    if (!isCodeFile || isExternalUrl || !file.baseUrl || !file.sessionId) return

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
  }, [isCodeFile, isExternalUrl, file.filepath, file.sessionId, file.baseUrl])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      message.success('已复制到剪贴板')
    } catch {
      message.error('复制失败')
    }
  }, [content])

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

    if (isExternalUrl && content && language === 'html') {
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(content)
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
  }, [file, isExternalUrl, content, language, courseTableArtifact])

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

  const externalPreviewable = isExternalUrl && previewable
  const externalCodeFile = isExternalUrl && isCodeFile
  const showViewSwitcher = previewable || hasStructuredPreview

  return (
    <div className={styles.artifactPanel}>
      <div className={styles.artifactHeader}>
        <div className={styles.artifactHeaderLeft}>
          {files.length > 1 ? (
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
          ) : (
            <div className={styles.artifactTitle}>{displayFilename}</div>
          )}
        </div>

        <div className={styles.artifactHeaderCenter}>
          {showViewSwitcher && (
            <Segmented
              className={styles.artifactModeSwitch}
              value={viewMode}
              onChange={(val) => setViewMode(val as 'code' | 'preview')}
              options={[
                { label: <CodeOutlined />, value: 'code', title: '代码' },
                { label: <EyeOutlined />, value: 'preview', title: '预览' },
              ]}
            />
          )}
        </div>

        <div className={styles.artifactHeaderRight}>
          <div className={styles.artifactActionBar}>
            {(isCodeFile || externalCodeFile) && (
              <Button
                type="text"
                size="small"
                className={styles.artifactIconButton}
                icon={<CopyOutlined />}
                aria-label="复制文件内容"
                title="复制"
                onClick={handleCopy}
              />
            )}
            <Button
              type="text"
              size="small"
              className={styles.artifactIconButton}
              icon={<LinkOutlined />}
              aria-label="新窗口打开"
              title="新窗口"
              onClick={handleOpenInNewTab}
            />
            <Button
              type="text"
              size="small"
              className={styles.artifactIconButton}
              icon={<DownloadOutlined />}
              aria-label="下载文件"
              title="下载"
              onClick={handleDownload}
            />
            <Button
              type="text"
              size="small"
              className={styles.artifactIconButton}
              icon={<CloseOutlined />}
              aria-label="关闭预览"
              title="关闭"
              onClick={handleClose}
            />
          </div>
        </div>
      </div>

      <div className={styles.artifactBody}>
        {hasStructuredPreview && viewMode === 'preview' && (
          <div className={styles.artifactStructuredWrap}>
            {loading ? (
              <div className={styles.artifactLoading}>加载中...</div>
            ) : (
              <CourseTablePreview courseTable={courseTableArtifact} />
            )}
          </div>
        )}

        {/* External URL: HTML preview via srcdoc */}
        {externalPreviewable && viewMode === 'preview' && language === 'html' && !hasStructuredPreview && (
          <div className={styles.artifactPreviewWrap}>
            {loading ? (
              <div className={styles.artifactLoading}>加载中...</div>
            ) : (
              <iframe
                className={styles.artifactIframe}
                srcDoc={content}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            )}
          </div>
        )}

        {/* External URL: Markdown preview */}
        {externalPreviewable && viewMode === 'preview' && language === 'markdown' && !hasStructuredPreview && (
          <div className={styles.artifactMarkdownWrap}>
            {loading ? (
              <div className={styles.artifactLoading}>加载中...</div>
            ) : (
              <MarkdownContent content={content} isStreaming={false} />
            )}
          </div>
        )}

        {/* External URL: code view */}
        {externalCodeFile && viewMode === 'code' && (
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

        {/* External URL: non-code fallback - iframe direct */}
        {isExternalUrl && !isCodeFile && (
          <div className={styles.artifactPreviewWrap}>
            <iframe
              className={styles.artifactIframe}
              src={file.filepath}
            />
          </div>
        )}

        {/* Internal URL: Markdown preview */}
        {previewable && viewMode === 'preview' && language === 'markdown' && !isExternalUrl && !hasStructuredPreview && (
          <div className={styles.artifactMarkdownWrap}>
            {loading ? (
              <div className={styles.artifactLoading}>加载中...</div>
            ) : (
              <MarkdownContent content={content} isStreaming={false} />
            )}
          </div>
        )}

        {/* Internal URL: HTML preview */}
        {previewable && viewMode === 'preview' && language === 'html' && !isExternalUrl && !hasStructuredPreview && (
          <div className={styles.artifactPreviewWrap}>
            <iframe
              className={styles.artifactIframe}
              src={previewUrl}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        )}

        {/* Internal URL: code view */}
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

        {/* Internal URL: non-code fallback */}
        {!isCodeFile && !isExternalUrl && (
          <div className={styles.artifactPreviewWrap}>
            <iframe
              className={styles.artifactIframe}
              src={previewUrl}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  )
}
