import { readFileSync } from 'node:fs'

const checks = [
  {
    file: 'src/components/TaskDetailPanel/index.tsx',
    pattern: 'bordered={false}',
    message: 'Tag 不要再用 bordered={false}，改成 variant="filled"。',
  },
  {
    file: 'src/components/TaskTable/index.tsx',
    pattern: 'bordered={false}',
    message: 'Select / Tag 不要再用 bordered={false}，改成对应的 variant 写法。',
  },
]

const failures = checks.flatMap(({ file, pattern, message }) => {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

  return source.includes(pattern) ? [`${file}: ${message}`] : []
})

if (failures.length > 0) {
  console.error('发现 antd 已废弃的 bordered 用法：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('未发现 antd 已废弃的 bordered 用法。')
