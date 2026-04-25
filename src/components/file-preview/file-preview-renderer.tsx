import Button from 'antd/es/button'
import Segmented from 'antd/es/segmented'
import Spin from 'antd/es/spin'
import message from 'antd/es/message'
import { useCallback, useMemo, useState } from 'react'
import {
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  ExpandOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import styles from './file-preview.module.less'

interface FilePreviewRendererProps {
  content: string
  language: string | null
  fileName: string
  isImage: boolean
  isCodeFile: boolean
  previewable: boolean
  loading: boolean
  imageUrl?: string
  onCopy?: () => Promise<void> | void
  onOpenInNewTab?: () => void
  onDownload?: () => void
  onClose?: () => void
}

export function FilePreviewRenderer({
  content,
  language,
  fileName,
  isImage,
  isCodeFile,
  previewable,
  loading,
  imageUrl,
  onCopy,
  onOpenInNewTab,
  onDownload,
  onClose,
}: FilePreviewRendererProps) {
  const [viewMode, setViewMode] = useState<'code' | 'preview'>(
    previewable ? 'preview' : 'code',
  )

  const displayFilename = useMemo(() => fileName, [fileName])
  const effectiveViewMode = useMemo<'code' | 'preview'>(() => {
    if (previewable) {
      return viewMode
    }
    return 'code'
  }, [previewable, viewMode])

  const handleCopy = useCallback(async () => {
    if (!onCopy) return
    try {
      await onCopy()
      message.success('已复制到剪贴板')
    } catch {
      message.error('复制失败')
    }
  }, [onCopy])

  const renderBody = () => {
    if (loading) {
      return (
        <div className={styles.previewLoading}>
          <Spin size="large" />
        </div>
      )
    }

    if (isImage && imageUrl) {
      return (
        <div className={styles.previewImageWrap}>
          <img className={styles.previewImage} src={imageUrl} alt={displayFilename} />
        </div>
      )
    }

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

    if (content) {
      return (
        <div className={styles.previewCodeWrap}>
          <pre className={styles.previewCode}>
            <code>{content}</code>
          </pre>
        </div>
      )
    }

    return <div className={styles.previewEmpty}>无法预览此文件类型</div>
  }

  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <div className={styles.previewHeaderLeft}>
          <div className={styles.previewTitle} title={displayFilename}>
            {displayFilename}
          </div>
        </div>
        <div className={styles.previewHeaderCenter}>
          {previewable && (
            <Segmented
              className={styles.previewModeSwitch}
              value={viewMode}
              onChange={(value) => setViewMode(value as 'code' | 'preview')}
              options={[
                { label: <CodeOutlined />, value: 'code', title: '代码' },
                { label: <EyeOutlined />, value: 'preview', title: '预览' },
              ]}
            />
          )}
        </div>
        <div className={styles.previewHeaderRight}>
          <div className={styles.previewActionBar}>
            {isCodeFile && onCopy && (
              <Button
                type="text"
                size="small"
                className={styles.previewIconButton}
                icon={<CopyOutlined />}
                title="复制"
                aria-label="复制文件内容"
                onClick={() => void handleCopy()}
              />
            )}
            {onOpenInNewTab && (
              <Button
                type="text"
                size="small"
                className={styles.previewIconButton}
                icon={<ExpandOutlined />}
                title="全屏查看"
                aria-label="全屏查看"
                onClick={onOpenInNewTab}
              />
            )}
            {onDownload && (
              <Button
                type="text"
                size="small"
                className={styles.previewIconButton}
                icon={<DownloadOutlined />}
                title="下载"
                aria-label="下载文件"
                onClick={onDownload}
              />
            )}
            {onClose && (
              <Button
                type="text"
                size="small"
                className={styles.previewIconButton}
                icon={<CloseOutlined />}
                title="关闭"
                aria-label="关闭预览"
                onClick={onClose}
              />
            )}
          </div>
        </div>
      </div>
      <div className={styles.previewBody}>{renderBody()}</div>
    </div>
  )
}
