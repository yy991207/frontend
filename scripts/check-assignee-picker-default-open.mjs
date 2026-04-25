import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const requiredSnippets = [
  {
    snippet: 'function AssigneePicker',
    message: '负责人选择还没有收口成独立组件，容易出现两处交互不一致。',
  },
  {
    snippet: 'open={selectOpen}',
    message: '负责人下拉没有受控打开，首次点击后还是会停在空弹层。',
  },
  {
    snippet: 'setSelectOpen(open)',
    message: '外层 Popover 打开时，没有同步把内层 Select 下拉展开。',
  },
]

const failures = requiredSnippets.flatMap(({ snippet, message }) => {
  return source.includes(snippet) ? [] : [`${file}: ${message}`]
})

if (failures.length > 0) {
  console.error('发现负责人选择缺少默认展开能力：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('负责人选择已支持首次点击直接展开。')
