import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../src/components/TaskTable/index.tsx', import.meta.url),
  'utf8',
)

const persistStart = source.indexOf('const persistVisibleColumnOrder')
const persistEnd = source.indexOf('const handleAddVisibleColumn', persistStart)
const persistSource = source.slice(persistStart, persistEnd)

assert.notEqual(persistStart, -1, '没有找到字段移动排序持久化逻辑。')
assert.notEqual(persistEnd, -1, '没有找到字段移动排序持久化逻辑结束位置。')

assert.doesNotMatch(
  persistSource,
  /is_visible:\s*nextVisibleKeys\.includes/,
  '移动字段位置时不能根据本地 nextVisibleKeys 重写 is_visible，否则刷新后可能把字段误隐藏。',
)

assert.doesNotMatch(
  persistSource,
  /updateCustomField\([\s\S]*is_visible:/,
  '移动字段位置只应该保存 sort_order，不能顺带写 is_visible。',
)

assert.match(
  source,
  /handleHideVisibleColumn[\s\S]*updateCustomField\(projectId,\s*targetField\.field_id,\s*\{\s*is_visible:\s*false\s*\}/,
  '隐藏字段入口仍然应该显式保存 is_visible=false。',
)

console.log('field move preserves visibility check ok')
