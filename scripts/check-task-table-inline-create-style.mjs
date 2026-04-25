import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readSource(file) {
  return readFile(new URL(`../${file}`, import.meta.url), 'utf8')
}

async function testNewTaskEntryUsesBlockContainer() {
  const source = await readSource('src/components/TaskTable/index.tsx')
  const buildRowsStart = source.indexOf('const buildTableRows = () => {')
  const buildRowsEnd = source.indexOf('const tableRows = buildTableRows()', buildRowsStart)
  const buildRowsSource =
    buildRowsStart >= 0 && buildRowsEnd >= 0
      ? source.slice(buildRowsStart, buildRowsEnd)
      : source

  assert.match(
    source,
    /className="new-task-entry"/,
    '分组下的“新建任务”入口应该有独立的大块容器 new-task-entry，不能继续只靠按钮本身撑样式。',
  )

  assert.match(
    source,
    /className="new-task-entry-label"/,
    '“新建任务”入口应该有独立文案节点，方便做整块 hover 和留白控制。',
  )

  assert.match(
    buildRowsSource,
    /rowKind: 'newTask'/,
    '分组下应该继续渲染 newTask 行，不能把入口直接删掉。',
  )

  assert.doesNotMatch(
    buildRowsSource,
    /config\.toolbar\.showCreate\s*&&\s*isSectionGroupMode/,
    'newTask 行不应该再依赖 toolbar.showCreate；这个入口要在 section 分组里直接可见。',
  )
}

async function testInlineCreateUsesLargeFieldShells() {
  const source = await readSource('src/components/TaskTable/index.tsx')

  assert.match(
    source,
    /className="inline-create-title-box"/,
    '标题编辑态应该包在 inline-create-title-box 里，做成大方框输入样式。',
  )

  assert.match(
    source,
    /className=\{`inline-create-field-shell \$\{field === 'start' \? 'inline-create-date-shell-start' : 'inline-create-date-shell-due'\}`\}/,
    '日期编辑态应该使用独立的大方框字段壳层，不能直接把 date-trigger 裸放在单元格里。',
  )
}

async function testStylesPromoteBlockLayoutInsteadOfLightweightControls() {
  const style = await readSource('src/components/TaskTable/index.less')

  assert.match(
    style,
    /\.new-task-entry \{[\s\S]*min-height: 44px[\s\S]*border-radius: 10px/,
    '“新建任务”入口样式应该是整块点击区，至少包含更高的行高和圆角。',
  )

  assert.match(
    style,
    /\.inline-create-table-row > td \{[\s\S]*background: #edf4ff !important;/,
    '行内新建态整行底色应该升级成更明显的整块浅蓝背景。',
  )

  assert.match(
    style,
    /\.inline-create-title-box \{[\s\S]*min-height: 36px[\s\S]*border: 1px solid #d7deeb[\s\S]*background: #fff;/,
    '标题输入框外层应该是白底描边的大方框，而不是透明输入框。',
  )
}

async function testOnlyActiveFieldUsesHighlightedEditorShell() {
  const source = await readSource('src/components/TaskTable/index.tsx')
  const style = await readSource('src/components/TaskTable/index.less')

  assert.match(
    source,
    /inlineCreateFocusedField === 'title' \? 'active' : ''/,
    '标题输入框应该继续只在当前激活时带 active 状态。',
  )

  assert.match(
    source,
    /inlineCreateFocusedField === 'priority' \? 'active' : ''/,
    '优先级字段应该继续只在当前激活时带 active 状态。',
  )

  assert.match(
    source,
    /inlineCreateFocusedField === 'assignee' \? 'active' : ''/,
    '负责人字段应该继续只在当前激活时带 active 状态。',
  )

  assert.match(
    source,
    /inlineCreateFocusedField === field \? 'active' : ''/,
    '日期字段应该继续只在当前激活时带 active 状态。',
  )

  assert.doesNotMatch(
    style,
    /\.inline-create-field-shell \{[\s\S]*border: 1px solid #d7deeb[\s\S]*background: #fff;[\s\S]*box-shadow: 0 1px 2px/,
    '普通字段默认不应该全部渲染成白色编辑框，否则一整排都会像同时进入编辑态。',
  )

  assert.match(
    style,
    /\.inline-create-field-shell \{[\s\S]*border: 1px solid transparent[\s\S]*background: transparent[\s\S]*box-shadow: none;/,
    '普通字段默认应该是透明壳层，只保留轻量占位效果。',
  )

  assert.match(
    style,
    /\.inline-create-field-cell \{\s*[\s\S]*&\.active \{\s*[\s\S]*\.inline-create-field-shell \{\s*[\s\S]*border: 1px solid #d7deeb[\s\S]*background: #fff;/,
    '通用字段应该只在 active 状态时切成白底描边的大方框。',
  )
}

async function testTitleEditorUsesFullHeightRectStyle() {
  const source = await readSource('src/components/TaskTable/index.tsx')
  const style = await readSource('src/components/TaskTable/index.less')
  const editableInputSource = await readSource('src/components/EditableInput/index.tsx')

  assert.match(
    style,
    /\.inline-create-title-box \{[\s\S]*min-height: 36px[\s\S]*padding: 0[\s\S]*border-radius: 0/,
    '新建任务标题输入框应该是矩形外框，且上下没有额外留白。',
  )

  assert.match(
    style,
    /\.inline-title-input \{[\s\S]*&\.ant-input \{[\s\S]*height: 100%[\s\S]*padding: 0 14px/,
    '新建任务标题输入框内容应该撑满外框高度，只保留左右内边距。',
  )

  assert.match(
    source,
    /className="task-title-edit-box"/,
    '已创建任务进入编辑态时应该有独立的 task-title-edit-box，和新建任务标题框保持统一。',
  )

  assert.match(
    style,
    /\.task-title-edit-box \{[\s\S]*min-height: 36px[\s\S]*padding: 0[\s\S]*border-radius: 0/,
    '已创建任务编辑框也应该是矩形满高样式，不能继续保留旧的小输入框外观。',
  )

  assert.match(
    editableInputSource,
    /size="middle"/,
    '已创建任务编辑态里的输入框应该至少切到 middle，不能继续用 small。',
  )
}

async function main() {
  await testNewTaskEntryUsesBlockContainer()
  await testInlineCreateUsesLargeFieldShells()
  await testStylesPromoteBlockLayoutInsteadOfLightweightControls()
  await testOnlyActiveFieldUsesHighlightedEditorShell()
  await testTitleEditorUsesFullHeightRectStyle()
  console.log('task table inline create style check ok')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
