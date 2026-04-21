import { render, screen } from '@testing-library/react'
import { AppPageShell, AppSurfacePanel } from './AppPageShell'

describe('AppPageShell', () => {
  it('默认输出公共页面壳和公共面板结构，并保留传入的类名', () => {
    render(
      <AppPageShell className="page-extra" testId="page-shell">
        <AppSurfacePanel className="panel-extra" testId="surface-panel">
          <span>布局内容</span>
        </AppSurfacePanel>
      </AppPageShell>,
    )

    const pageShell = screen.getByTestId('page-shell')
    const surfacePanel = screen.getByTestId('surface-panel')

    expect(pageShell).toBeInTheDocument()
    expect(pageShell).toHaveClass('page-extra')
    expect(surfacePanel).toBeInTheDocument()
    expect(surfacePanel).toHaveClass('panel-extra')
    expect(screen.getByText('布局内容')).toBeVisible()
  })

  it('支持切换成别的语义标签，方便不同页面复用', () => {
    render(
      <AppPageShell as="div" testId="page-shell">
        <AppSurfacePanel as="aside" testId="surface-panel">
          <span>语义标签</span>
        </AppSurfacePanel>
      </AppPageShell>,
    )

    expect(screen.getByTestId('page-shell').tagName).toBe('DIV')
    expect(screen.getByTestId('surface-panel').tagName).toBe('ASIDE')
  })
})
