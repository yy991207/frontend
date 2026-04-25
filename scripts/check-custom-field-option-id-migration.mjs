import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [customFieldServiceSource, taskServiceSource, taskTableSource, activityViewSource, taskDetailSource] = await Promise.all([
  readFile(new URL('../src/services/customFieldService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/taskService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TaskTable/index.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ActivityView/index.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TaskDetailPanel/index.tsx', import.meta.url), 'utf8'),
])

assert.doesNotMatch(
  customFieldServiceSource,
  /\bvalue:\s*string\b/,
  '自定义字段选项接口还在使用 option.value，应该统一改成 option.id。',
)

assert.match(
  taskTableSource,
  /guid:\s*o\.id/,
  'TaskTable 里的字段定义映射还没有从 option.id 生成前端选项 guid。',
)

assert.match(
  taskServiceSource,
  /custom_fields_display\?:\s*Record<string,\s*unknown>/,
  '任务服务层还没有接住 custom_fields_display 返回值。',
)

assert.match(
  taskServiceSource,
  /custom_fields_display:\s*api\.custom_fields_display\s*\?\?\s*\{\}/,
  'apiTaskToTask 还没有把 custom_fields_display 映射到前端任务对象。',
)

assert.match(
  activityViewSource,
  /new_value_label|old_value_label/,
  '动态视图还没有接住活动动态里的 *_value_label 展示字段。',
)

assert.match(
  taskDetailSource,
  /new_value_label|old_value_label/,
  '任务详情历史还没有接住活动动态里的 *_value_label 展示字段。',
)

console.log('custom field option id migration check ok')
