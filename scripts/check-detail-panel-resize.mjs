import { readFileSync } from 'node:fs'

const componentFile = 'src/components/TaskDetailPanel/index.tsx'
const styleFile = 'src/components/TaskDetailPanel/index.less'
const componentSource = readFileSync(new URL(`../${componentFile}`, import.meta.url), 'utf8')
const styleSource = readFileSync(new URL(`../${styleFile}`, import.meta.url), 'utf8')

const failures = []

if (!componentSource.includes('const [panelWidth, setPanelWidth] = useState(360)')) {
  failures.push(`${componentFile}: 还没有详情面板宽度状态，无法拖拽缩放。`)
}

if (!componentSource.includes('className="detail-resize-handle"')) {
  failures.push(`${componentFile}: 还没有左侧拖拽手柄节点。`)
}

if (!componentSource.includes('style={{ width: panelWidth, minWidth: panelWidth }}')) {
  failures.push(`${componentFile}: 详情面板宽度还没有绑定到运行时状态。`)
}

if (!styleSource.includes('.detail-resize-handle')) {
  failures.push(`${styleFile}: 还没有拖拽手柄样式。`)
}

if (failures.length > 0) {
  console.error('发现详情面板横向拖拽还没接通：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('详情面板横向拖拽已接通。')
