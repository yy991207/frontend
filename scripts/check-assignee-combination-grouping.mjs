import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const failures = []

if (!source.includes('buildAssigneeGroupSection(task)')) {
  failures.push(`${file}: 负责人分组需要按整组负责人生成分组，而不是按单个负责人拆分。`)
}

if (!source.includes('const assigneeGroupKey = assigneeMembers')) {
  failures.push(`${file}: 负责人组合分组缺少稳定 key，同一批负责人可能无法归到同一组。`)
}

if (!source.includes("guid: `__assignee-combo__${assigneeGroupKey}`")) {
  failures.push(`${file}: 负责人组合分组 guid 需要使用组合 key，避免单人 guid 拆桶。`)
}

if (source.includes('assigneeMembers.forEach((member) => {')) {
  failures.push(`${file}: 负责人分组仍在逐个负责人追加任务，会导致同一个任务出现在多个单人分组里。`)
}

if (failures.length > 0) {
  console.error('发现负责人分组仍按单人拆分：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('负责人分组已按人员组合归类。')
