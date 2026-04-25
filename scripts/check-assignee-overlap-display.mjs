import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const requiredSnippets = [
  {
    snippet: 'tasklist-assignee-group',
    message: '清单视图还没有多人头像重叠样式类。',
  },
  {
    snippet: 'selectedUsers.map((user) => (',
    message: '负责人展示还没有按多人列表渲染头像。',
  },
]

const failures = requiredSnippets.flatMap(({ snippet, message }) => {
  return source.includes(snippet) ? [] : [`${file}: ${message}`]
})

if (failures.length > 0) {
  console.error('发现负责人多选展示还没切到重叠头像：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('负责人多选展示已切到重叠头像。')
