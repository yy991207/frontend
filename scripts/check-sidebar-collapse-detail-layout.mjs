import { readFileSync } from 'node:fs'

const pageFile = 'src/pages/TaskList.tsx'
const styleFile = 'src/pages/TaskList.less'
const pageSource = readFileSync(new URL(`../${pageFile}`, import.meta.url), 'utf8')
const styleSource = readFileSync(new URL(`../${styleFile}`, import.meta.url), 'utf8')

const failures = []

if (!pageSource.includes('<Layout className="app-main-layout">')) {
  failures.push(`${pageFile}: 还没有单独的主内容横向布局容器，侧栏收起后详情面板仍可能掉到下方。`)
}

if (!styleSource.includes('.app-layout {\n  height: 100vh;\n  overflow: hidden;\n  position: relative;\n  display: flex;')) {
  failures.push(`${styleFile}: 根布局还没有固定成横向 flex，侧栏收起时布局方向会漂。`)
}

if (!styleSource.includes('.app-main-layout')) {
  failures.push(`${styleFile}: 还没有主内容布局类，无法约束内容区和详情面板同排显示。`)
}

if (!styleSource.includes('min-width: 0;')) {
  failures.push(`${styleFile}: 主内容区还没有最小宽度收缩约束，详情面板放大后容易把布局撑错位。`)
}

if (failures.length > 0) {
  console.error('发现侧栏收起时详情面板布局还没修好：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('侧栏收起时详情面板布局已稳定。')
