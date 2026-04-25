import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readSource(file) {
  return readFile(new URL(`../${file}`, import.meta.url), 'utf8')
}

async function testSectionTitleUsesPointerCursor() {
  const source = await readSource('src/components/TaskTable/index.tsx')
  const style = await readSource('src/components/TaskTable/index.less')

  assert.match(
    source,
    /className="section-name"/,
    '主页面任务分组标题应该继续使用 section-name 节点承载展示。',
  )

  assert.match(
    source,
    /className="new-section-input"/,
    '主页面任务分组进入编辑态时应该继续走独立输入框，不能把静态标题直接改成输入框。',
  )

  assert.match(
    style,
    /\.section-name \{[^}]*cursor: pointer;/,
    '主页面任务分组标题点击后是展开或查看，不是直接输入编辑，所以光标应该是手指。',
  )
}

async function main() {
  await testSectionTitleUsesPointerCursor()
  console.log('task table section cursor check ok')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
