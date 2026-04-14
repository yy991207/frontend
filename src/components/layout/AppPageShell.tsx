import type { ElementType, ReactNode } from 'react'
import styles from './appPageShell.module.less'

type LayoutElement = ElementType

type BaseLayoutProps = {
  as?: LayoutElement
  className?: string
  children: ReactNode
  testId?: string
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

export function AppPageShell({
  as: Component = 'main',
  className,
  children,
  testId,
}: BaseLayoutProps) {
  return (
    <Component className={joinClassNames(styles.page, className)} data-testid={testId}>
      {children}
    </Component>
  )
}

export function AppSurfacePanel({
  as: Component = 'section',
  className,
  children,
  testId,
}: BaseLayoutProps) {
  return (
    <Component className={joinClassNames(styles.surface, className)} data-testid={testId}>
      {children}
    </Component>
  )
}
