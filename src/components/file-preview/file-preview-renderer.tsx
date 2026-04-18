import {
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  ExpandOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { Button, message, Segmented, Spin } from 'antd'
import { useCallback, useMemo, useState } from 'react'

import type { CourseTableArtifact } from '../../core/artifacts/course-table'
import { buildMarkdownPreviewHtml, renderMarkdownToHtml } from '../../core/artifacts/markdown-render'
import { getFileName } from '../../core/utils/files'
import styles from './file-preview.module.less'

type FilePreviewRendererProps = {
  // Content data
  content: string
  language: string | null
  fileName: string
  isImage: boolean
  isCodeFile: boolean
  previewable: boolean

  // Structured preview
  courseTable: CourseTableArtifact | null

  // Loading state
  loading: boolean

  // Image preview URL
  imageUrl?: string

  // Callbacks (optional - button only rendered if callback provided)
  onCopy?: () => void
  onOpenInNewTab?: () => void
  onDownload?: () => void
  onClose?: () => void
}

function formatDuration(duration: number): string {
  return `${duration.toFixed(1)} 分钟`
}

function CourseTablePreview({ courseTable }: { courseTable: CourseTableArtifact }) {
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

export function FilePreviewRenderer({
  content,
  language,
  fileName,
  isImage,
  isCodeFile,
  previewable,
  courseTable,
  loading,
  imageUrl,
  onCopy,
  onOpenInNewTab,
  onDownload,
  onClose,
}: FilePreviewRendererProps) {
  const hasStructuredPreview = courseTable !== null
  const [viewMode, setViewMode] = useState<'code' | 'preview'>(
    previewable ? 'preview' : 'code',
  )

  const displayFilename = useMemo(() => {
    return getArtifactDisplayName(fileName)
  }, [fileName])

  // Auto-switch viewMode when file type changes
  const effectiveViewMode = useMemo(() => {
    if (previewable || hasStructuredPreview) return 'preview'
    return 'code'
  }, [previewable, hasStructuredPreview])

  const handleCopy = useCallback(async () => {
    if (!onCopy) return
    try {
      await onCopy()
      message.success('已复制到剪贴板')
    } catch {
      message.error('复制失败')
    }
  }, [onCopy])

  const handleOpenInNewTab = useCallback(() => {
    if (!onOpenInNewTab) return

    // Default behavior: open in new tab
    // Adapters can override by providing their own onOpenInNewTab
    onOpenInNewTab()
  }, [onOpenInNewTab])

  const handleDownload = useCallback(() => {
    onDownload?.()
  }, [onDownload])

  const handleClose = useCallback(() => {
    onClose?.()
  }, [onClose])

  const showViewSwitcher = previewable || hasStructuredPreview

  // Render body content based on type and view mode
  const renderBody = () => {
    if (loading) {
      return (
        <div className={styles.previewLoading}>
          <Spin size="large" />
        </div>
      )
    }

    // Course table structured preview
    if (hasStructuredPreview && effectiveViewMode === 'preview') {
      return (
        <div className={styles.previewStructuredWrap}>
          <CourseTablePreview courseTable={courseTable} />
        </div>
      )
    }

    // HTML preview
    if (previewable && effectiveViewMode === 'preview' && language === 'html' && content) {
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

    // Markdown preview
    if (previewable && effectiveViewMode === 'preview' && language === 'markdown' && content) {
      const htmlContent = renderMarkdownToHtml(content)
      const fullHtml = buildMarkdownPreviewHtml(displayFilename, htmlContent, true)
      return (
        <div className={styles.previewMarkdownWrap}>
          <iframe
            className={styles.previewMarkdownIframe}
            srcDoc={fullHtml}
            sandbox="allow-same-origin"
            title="Markdown Preview"
          />
        </div>
      )
    }

    // Image preview
    if (isImage && imageUrl) {
      return (
        <div className={styles.previewImageWrap}>
          <img
            className={styles.previewImage}
            src={imageUrl}
            alt={displayFilename}
          />
        </div>
      )
    }

    // Code view (for code files or fallback)
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
  }

  return (
    <div className={styles.previewContainer}>
      {/* Header */}
      <div className={styles.previewHeader}>
        <div className={styles.previewHeaderLeft}>
          <div className={styles.previewTitle} title={displayFilename}>
            {displayFilename}
          </div>
        </div>

        <div className={styles.previewHeaderCenter}>
          {showViewSwitcher && (
            <Segmented
              className={styles.previewModeSwitch}
              value={viewMode}
              onChange={(val) => setViewMode(val as 'code' | 'preview')}
              options={[
                { label: <CodeOutlined />, value: 'code', title: '代码' },
                { label: <EyeOutlined />, value: 'preview', title: '预览' },
              ]}
            />
          )}
        </div>

        <div className={styles.previewHeaderRight}>
          <div className={styles.previewActionBar}>
            {(isCodeFile) && onCopy && (
              <Button
                type="text"
                size="small"
                className={styles.previewIconButton}
                icon={<CopyOutlined />}
                aria-label="复制文件内容"
                title="复制"
                onClick={handleCopy}
              />
            )}
            {onOpenInNewTab && (
              <Button
                type="text"
                size="small"
                className={styles.previewIconButton}
                icon={<ExpandOutlined />}
                aria-label="全屏查看"
                title="全屏查看"
                onClick={handleOpenInNewTab}
              />
            )}
            {onDownload && (
              <Button
                type="text"
                size="small"
                className={styles.previewIconButton}
                icon={<DownloadOutlined />}
                aria-label="下载文件"
                title="下载"
                onClick={handleDownload}
              />
            )}
            {onClose && (
              <Button
                type="text"
                size="small"
                className={styles.previewIconButton}
                icon={<CloseOutlined />}
                aria-label="关闭预览"
                title="关闭"
                onClick={handleClose}
              />
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={styles.previewBody}>
        {renderBody()}
      </div>
    </div>
  )
}
