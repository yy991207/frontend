import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const failures = []

if (!source.includes('assigneeUsers?: User[]')) {
  failures.push(`${file}: 负责人组合分组需要把负责人用户列表带到分组数据里。`)
}

if (!source.includes('renderSectionName(section)')) {
  failures.push(`${file}: 分组标题需要走统一渲染函数，负责人组合才能渲染头像。`)
}

if (!source.includes('section-assignee-group-title')) {
  failures.push(`${file}: 负责人组合分组标题还没有专用头像容器样式类。`)
}

if (!source.includes('section.assigneeUsers') || !source.includes('<Avatar.Group size={20} max={{ count: 3 }}>')) {
  failures.push(`${file}: 负责人组合分组标题需要使用 Avatar.Group，和负责人列保持一致。`)
}

if (!source.includes('className="tasklist-assignee-avatar"')) {
  failures.push(`${file}: 负责人组合分组标题需要复用负责人头像样式。`)
}

if (failures.length > 0) {
  console.error('发现负责人组合分组标题还不是头像样式：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('负责人组合分组标题已使用头像样式。')
