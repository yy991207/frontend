import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const requiredSnippets = [
  {
    snippet: 'const handleAddVisibleColumn = (column: ExtendedColumnKey) => {',
    message: '还没有单独的字段新增逻辑，点字段配置后不会往当前页面加列。',
  },
  {
    snippet: 'onClick={() => handleAddVisibleColumn(field.key)}',
    message: '字段配置面板里的字段项还没有接到新增列逻辑。',
  },
  {
    snippet: '<Popover trigger="click" placement="bottomRight" content={fieldConfigPanel}>',
    message: '表头右侧加号还没有接字段配置弹层。',
  },
  {
    snippet: 'allFieldOptions.map((field) => (',
    message: '字段配置面板还没有按字段列表渲染新增入口。',
  },
]

const failures = requiredSnippets.flatMap(({ snippet, message }) => {
  return source.includes(snippet) ? [] : [`${file}: ${message}`]
})

if (failures.length > 0) {
  console.error('发现字段配置逻辑还没接通：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('字段配置逻辑已接通。')
