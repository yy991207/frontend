import type { ComponentProps, ReactNode } from 'react'
import { createContext, memo, useContext, useMemo, useState } from 'react'

import styles from '../../pages/Chat/chat.module.less'

type ChainOfThoughtContextValue = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

type ChainOfThoughtProps = ComponentProps<'div'> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

type ChainOfThoughtStepProps = ComponentProps<'div'> & {
  icon?: ReactNode
  label: ReactNode
  description?: ReactNode
  status?: 'complete' | 'active' | 'pending'
  isLast?: boolean
}

type ChainOfThoughtContentProps = ComponentProps<'div'>
type ChainOfThoughtSearchResultsProps = ComponentProps<'div'>
type ChainOfThoughtSearchResultProps = ComponentProps<'span'>

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null)

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function useChainOfThought() {
  const context = useContext(ChainOfThoughtContext)

  if (!context) {
    throw new Error('ChainOfThought 相关组件必须包在 ChainOfThought 内部使用')
  }

  return context
}

export const ChainOfThought = memo(function ChainOfThought({
  className,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: ChainOfThoughtProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen)
  const isControlled = typeof open === 'boolean'
  const isOpen = isControlled ? open : innerOpen

  const setIsOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setInnerOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  const contextValue = useMemo(
    () => ({ isOpen, setIsOpen }),
    [isOpen],
  )

  return (
    <ChainOfThoughtContext.Provider value={contextValue}>
      <div className={cx(styles.chainOfThought, className)} {...props}>
        {children}
      </div>
    </ChainOfThoughtContext.Provider>
  )
})

export const ChainOfThoughtStep = memo(function ChainOfThoughtStep({
  className,
  icon,
  label,
  description,
  status = 'complete',
  isLast = false,
  children,
  ...props
}: ChainOfThoughtStepProps) {
  return (
    <div
      className={cx(
        styles.chainOfThoughtStep,
        status === 'active' && styles.chainOfThoughtStepActive,
        status === 'pending' && styles.chainOfThoughtStepPending,
        className,
      )}
      {...props}
    >
      <div className={styles.chainOfThoughtStepIconWrap}>
        <span className={styles.chainOfThoughtStepIcon}>{icon ?? <span className={styles.chainOfThoughtDot} />}</span>
        {!isLast ? <span className={styles.chainOfThoughtStepConnector} /> : null}
      </div>
      <div className={styles.chainOfThoughtStepBody}>
        <div className={styles.chainOfThoughtStepLabel}>{label}</div>
        {description ? <div className={styles.chainOfThoughtStepDescription}>{description}</div> : null}
        {children}
      </div>
    </div>
  )
})

export const ChainOfThoughtContent = memo(function ChainOfThoughtContent({
  className,
  children,
  ...props
}: ChainOfThoughtContentProps) {
  const { isOpen } = useChainOfThought()

  if (!isOpen) {
    return null
  }

  return (
    <div className={cx(styles.chainOfThoughtContent, className)} {...props}>
      {children}
    </div>
  )
})

export const ChainOfThoughtSearchResults = memo(function ChainOfThoughtSearchResults({
  className,
  children,
  ...props
}: ChainOfThoughtSearchResultsProps) {
  return (
    <div className={cx(styles.chainOfThoughtSearchResults, className)} {...props}>
      {children}
    </div>
  )
})

export const ChainOfThoughtSearchResult = memo(function ChainOfThoughtSearchResult({
  className,
  children,
  ...props
}: ChainOfThoughtSearchResultProps) {
  return (
    <span className={cx(styles.chainOfThoughtSearchResult, className)} {...props}>
      {children}
    </span>
  )
})
