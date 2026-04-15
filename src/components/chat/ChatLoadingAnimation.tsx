import { LoadingOutlined } from '@ant-design/icons'
import styles from './ChatLoadingAnimation.module.less'

const assistantLineClasses = [
  styles.messageSkeletonBarFull,
  styles.messageSkeletonBarFull,
  styles.messageSkeletonBarMedium,
  styles.messageSkeletonBarFull,
  styles.messageSkeletonBarLong,
  styles.messageSkeletonBarMedium,
  styles.messageSkeletonBarShort,
]

export function MessageLoading() {
  return (
    <div className={styles.loadingShell} aria-label="正在生成回复">
      <div className={styles.loadingSpinnerWrap} aria-hidden="true">
        <LoadingOutlined className={styles.loadingSpinner} />
      </div>
      <div className={styles.loadingLines}>
        <span className={`${styles.loadingLine} ${styles.loadingLineLong}`} />
        <span className={`${styles.loadingLine} ${styles.loadingLineMedium}`} />
        <span className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
      </div>
    </div>
  )
}

export function ThreadLoading() {
  return (
    <div className={styles.messageListSkeleton} aria-label="正在加载会话消息">
      <div className={styles.messageSkeletonUser}>
        <span className={`${styles.messageSkeletonBar} ${styles.messageSkeletonBarMedium}`} />
        <span className={`${styles.messageSkeletonBar} ${styles.messageSkeletonBarShort}`} />
      </div>

      <div className={styles.messageSkeletonAssistant}>
        {assistantLineClasses.map((className, index) => (
          <span key={`${className}-${index}`} className={`${styles.messageSkeletonBar} ${className}`} />
        ))}
      </div>
    </div>
  )
}
