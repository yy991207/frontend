import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const requiredSnippets = [
  {
    snippet: 'onTypeChange',
    message: '日期面板自定义头部缺少 onTypeChange，当前没法切到月份选择。',
  },
  {
    snippet: "type === 'month'",
    message: '日期面板没有根据当前面板类型切换头部展示，月份面板入口可能不可用。',
  },
]

const failures = requiredSnippets.flatMap(({ snippet, message }) => {
  return source.includes(snippet) ? [] : [`${file}: ${message}`]
})

if (failures.length > 0) {
  console.error('发现日期面板缺少月份切换支持：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('日期面板已包含月份切换支持。')
