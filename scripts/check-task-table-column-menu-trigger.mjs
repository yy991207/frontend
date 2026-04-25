import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readTaskTableSource() {
  return readFile(new URL('../src/components/TaskTable/index.tsx', import.meta.url), 'utf8')
}

async function readTaskTableStyle() {
  return readFile(new URL('../src/components/TaskTable/index.less', import.meta.url), 'utf8')
}

async function testColumnMenuUsesArrowTriggerOnly() {
  const source = await readTaskTableSource()
  const renderStart = source.indexOf('function renderAdjustableColumnTitle')
  const renderEnd = source.indexOf('const quickAddFieldPanel', renderStart)
  const renderSource = source.slice(renderStart, renderEnd)

  assert.match(
    renderSource,
    /<span className="table-column-title-label">\s*\{title\}\s*<\/span>/,
    '字段标题文字应该单独渲染，不能再作为下拉菜单触发器。',
  )
  assert.match(
    renderSource,
    /<button[\s\S]*className="table-column-title-trigger"[\s\S]*<DownOutlined \/>/,
    '字段菜单必须通过右侧向下箭头按钮触发。',
  )
  assert.match(
    renderSource,
    /<Dropdown[\s\S]*>\s*<button/,
    'Dropdown 的触发元素应该是箭头按钮，不应该包住整个标题。',
  )
  assert.doesNotMatch(
    renderSource,
    /<Dropdown[\s\S]*>\s*<span className="table-column-title-dropdown"/,
    '不能继续点击整个字段标题打开菜单。',
  )
}

async function testColumnMenuArrowOnlyShowsOnHover() {
  const style = await readTaskTableStyle()

  assert.match(
    style,
    /\.table-column-title-trigger \{[\s\S]*opacity: 0/,
    '字段菜单箭头默认应该隐藏。',
  )
  assert.match(
    style,
    /\.table-column-title-dropdown \{[\s\S]*&:hover,[\s\S]*\.table-column-title-trigger/,
    '鼠标滑过字段标题区域时才显示菜单箭头。',
  )
}

async function main() {
  await testColumnMenuUsesArrowTriggerOnly()
  await testColumnMenuArrowOnlyShowsOnHover()
  console.log('task table column menu trigger check ok')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
