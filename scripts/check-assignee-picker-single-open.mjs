import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const requiredSnippets = [
  {
    snippet: 'activeAssigneePickerKey',
    message: '缺少表格级负责人选择状态，旧弹层没法在打开新弹层时统一关闭。',
  },
  {
    snippet: 'pickerKey',
    message: '负责人选择器没有唯一标识，无法判断当前该打开哪一个。',
  },
  {
    snippet: 'open={open}',
    message: '负责人选择器还不是受控打开，多个弹层会各自保留状态。',
  },
]

const failures = requiredSnippets.flatMap(({ snippet, message }) => {
  return source.includes(snippet) ? [] : [`${file}: ${message}`]
})

if (failures.length > 0) {
  console.error('发现负责人选择缺少单例打开控制：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('负责人选择已限制为同一时间只打开一个。')
