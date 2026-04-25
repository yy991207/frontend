import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [taskListSource, taskTableSource, detailSource, editorSource, activitySource] =
  await Promise.all([
    readFile(new URL('../src/pages/TaskList.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/TaskTable/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/TaskDetailPanel/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/CustomFieldEditorModal/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ActivityView/index.tsx', import.meta.url), 'utf8'),
  ])

assert.match(
  taskListSource,
  /<TaskDetailPanel[\s\S]*key=\{selectedTask\.guid\}/,
  'TaskDetailPanel 需要按任务 guid 重挂载，避免继续靠 effect 手动清一串本地状态。',
)

assert.match(
  taskTableSource,
  /<CustomFieldEditorModal[\s\S]*key=\{/,
  'CustomFieldEditorModal 需要在切字段/模式时重建，避免继续靠 effect 同步初始化。',
)

assert.doesNotMatch(
  editorSource,
  /useEffect\(\(\) => \{\s*if \(open\)/,
  'CustomFieldEditorModal 里不应该继续用 effect 同步初始化本地表单状态。',
)

assert.doesNotMatch(
  activitySource,
  /setLoading\(true\)/,
  'ActivityView 不应该在 effect 里同步 setLoading(true)，应该从初始态进入加载。',
)

console.log('lint effect reset regression check ok')
