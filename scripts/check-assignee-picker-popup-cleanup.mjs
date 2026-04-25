import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const requiredSnippets = [
  {
    snippet: 'destroyOnHidden',
    message: '负责人 Popover 关闭后没有销毁内容，旧的选人层可能残留。',
  },
  {
    snippet: 'getPopupContainer',
    message: '负责人 Select 下拉没有绑定到当前弹层容器，旧 popup 可能挂在 body 上。',
  },
  {
    snippet: 'open={open}',
    message: '负责人 Select 下拉没有直接跟随外层 open，同步关闭不够彻底。',
  },
]

const failures = requiredSnippets.flatMap(({ snippet, message }) => {
  return source.includes(snippet) ? [] : [`${file}: ${message}`]
})

if (failures.length > 0) {
  console.error('发现负责人下拉缺少残留清理控制：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('负责人下拉已具备残留清理控制。')
