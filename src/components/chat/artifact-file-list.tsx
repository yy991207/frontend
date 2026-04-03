import { DownloadOutlined } from '@ant-design/icons'
import { Button, Card, Space } from 'antd'

import type { ArtifactFile } from './artifacts-context'
import { useArtifacts } from './artifacts-context'
import styles from './artifacts.module.less'
import { checkCodeFile, getFileExtensionDisplayName, getFileIcon, getFileName } from '../../core/utils/files'
import { buildArtifactDownloadUrl } from '../../core/artifacts/utils'

type ArtifactFileListProps = {
  files: ArtifactFile[]
  className?: string
}

export function ArtifactFileList({ files, className }: ArtifactFileListProps) {
  const { selectFile } = useArtifacts()

  if (!files.length) {
    return null
  }

    return (
    <div className={`${styles.fileList} ${className || ''}`}>
      {files.map((file) => {
        const isExternalUrl = file.filepath.startsWith('http://') || file.filepath.startsWith('https://')
        const displayFilename = isExternalUrl ? (() => {
          try { return new URL(file.filepath).pathname.split('/').pop() || file.filepath } catch { return file.filepath }
        })() : getFileName(file.filepath)
        const { isCodeFile } = checkCodeFile(displayFilename)
        const displayName = getFileExtensionDisplayName(displayFilename)
        const icon = getFileIcon(displayFilename)
        const downloadUrl = isExternalUrl ? file.filepath : buildArtifactDownloadUrl({
          baseUrl: file.baseUrl ?? '',
          sessionId: file.sessionId ?? '',
          filepath: file.filepath,
          download: true,
        })

        return (
          <Card
            key={file.filepath}
            className={styles.fileCard}
            hoverable
            onClick={() => selectFile(file)}
          >
            <div className={styles.fileCardInner}>
              <div className={styles.fileCardIcon}>{icon}</div>
              <div className={styles.fileCardInfo}>
                <div className={styles.fileCardName}>{displayFilename}</div>
                <div className={styles.fileCardType}>
                  {isCodeFile ? displayName : `${displayName} 文件`}
                </div>
              </div>
              <Space>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button type="text" size="small" icon={<DownloadOutlined />}>
                    下载
                  </Button>
                </a>
              </Space>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
