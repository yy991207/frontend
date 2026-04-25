import { readFileSync } from 'node:fs'

const styleFile = 'src/components/TaskDetailPanel/index.less'
const styleSource = readFileSync(new URL(`../${styleFile}`, import.meta.url), 'utf8')

const failures = []

if (!styleSource.includes('min-width: 188px;')) {
  failures.push(`${styleFile}: 分组弹层最小宽度还没收紧到 188px。`)
}

if (!styleSource.includes('max-width: 204px;')) {
  failures.push(`${styleFile}: 分组弹层最大宽度还没收紧到 204px。`)
}

if (!styleSource.includes('.tasklist-section-search-list {\n  max-height: 200px;\n  width: 100%;')) {
  failures.push(`${styleFile}: 分组列表容器还没有跟随窄弹层宽度铺满。`)
}

if (failures.length > 0) {
  console.error('发现任务详情分组弹层宽度还没收紧到目标尺寸：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('任务详情分组弹层宽度已收紧到目标尺寸。')
