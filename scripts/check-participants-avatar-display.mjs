import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const participantsBlock = source.slice(
  source.indexOf("if (columnKey === 'participants')"),
  source.indexOf("if (columnKey === 'followers')"),
)

const failures = []

if (!participantsBlock.includes('participantUsers')) {
  failures.push(`${file}: 参与人列需要先构造参与人用户列表，不能只拼接姓名文本。`)
}

if (!participantsBlock.includes('<Avatar.Group size={20} max={{ count: 3 }}>')) {
  failures.push(`${file}: 参与人列需要使用 Avatar.Group，和负责人列头像 UI 保持一致。`)
}

if (!participantsBlock.includes('className="tasklist-assignee-avatar"')) {
  failures.push(`${file}: 参与人头像需要复用负责人头像样式。`)
}

if (participantsBlock.includes('participantNames.join')) {
  failures.push(`${file}: 参与人列仍在用姓名文本拼接显示，没有切换成头像。`)
}

if (failures.length > 0) {
  console.error('发现参与人列还不是头像显示：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('参与人列已使用头像样式显示。')
