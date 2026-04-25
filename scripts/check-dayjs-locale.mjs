import { readFileSync } from 'node:fs'

const file = 'src/main.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const requiredSnippets = [
  {
    snippet: "import 'dayjs/locale/zh-cn'",
    message: '入口文件没有加载 dayjs 中文 locale。',
  },
  {
    snippet: "dayjs.locale('zh-cn')",
    message: '入口文件没有把 dayjs 全局 locale 切到 zh-cn。',
  },
]

const failures = requiredSnippets.flatMap(({ snippet, message }) => {
  return source.includes(snippet) ? [] : [`${file}: ${message}`]
})

if (failures.length > 0) {
  console.error('发现 dayjs locale 配置缺失：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('dayjs locale 已配置为 zh-cn。')
