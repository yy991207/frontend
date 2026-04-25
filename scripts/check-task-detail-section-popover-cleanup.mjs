import { readFileSync } from 'node:fs'

const componentFile = 'src/components/TaskDetailPanel/index.tsx'
const styleFile = 'src/components/TaskDetailPanel/index.less'
const componentSource = readFileSync(new URL(`../${componentFile}`, import.meta.url), 'utf8')
const styleSource = readFileSync(new URL(`../${styleFile}`, import.meta.url), 'utf8')

const failures = []

if (componentSource.includes('已添加任务分组')) {
  failures.push(`${componentFile}: 任务分组弹层里还保留着“已添加任务分组”标题。`)
}

if (componentSource.includes('className="tasklist-section-tags"')) {
  failures.push(`${componentFile}: 任务分组弹层里还保留着已选分组标签区。`)
}

if (componentSource.includes('handleRemoveTaskFromSection')) {
  failures.push(`${componentFile}: 任务分组弹层还保留着标签删除入口，说明旧交互没有删干净。`)
}

if (styleSource.includes('.tasklist-section-panel-title')) {
  failures.push(`${styleFile}: 任务分组弹层标题样式还没清掉。`)
}

if (styleSource.includes('.tasklist-section-tags')) {
  failures.push(`${styleFile}: 任务分组弹层标签区样式还没清掉。`)
}

if (failures.length > 0) {
  console.error('发现任务详情分组弹层里仍有待删除的旧内容：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('任务详情分组弹层里的旧标题和标签区已移除。')
