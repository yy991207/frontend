import { readFileSync } from 'node:fs'

const componentFile = 'src/components/Sidebar/index.tsx'
const styleFile = 'src/components/Sidebar/index.less'
const componentSource = readFileSync(new URL(`../${componentFile}`, import.meta.url), 'utf8')
const styleSource = readFileSync(new URL(`../${styleFile}`, import.meta.url), 'utf8')

const failures = []

if (componentSource.includes("<Badge color=\"#3370ff\" />")) {
  failures.push(`${componentFile}: 左侧任务清单前面还在用 Badge 蓝点。`)
}

if (!componentSource.includes('<FileDoneOutlined className="tasklist-icon" />')) {
  failures.push(`${componentFile}: 左侧任务清单前面还没有换成 FileDoneOutlined 图标。`)
}

if (!styleSource.includes('.tasklist-icon')) {
  failures.push(`${styleFile}: 左侧任务清单图标样式还没补上。`)
}

if (styleSource.includes('.ant-badge-status-dot')) {
  failures.push(`${styleFile}: 左侧任务清单还保留着 Badge 圆点样式。`)
}

if (failures.length > 0) {
  console.error('发现左侧任务清单图标还没有切到新的清单图标：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('左侧任务清单图标已切换为新的清单图标。')
