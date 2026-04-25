import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../src/components/TaskTable/index.tsx', import.meta.url),
  'utf8',
)

assert.match(
  source,
  /const visibleCustomFieldDefMap = new Map\(\s*rawCustomFields\s*\.filter/,
  '自定义字段列定义必须直接从接口返回的 rawCustomFields 派生，不能依赖可能滞后的 tasklist.custom_fields。',
)

const mapStart = source.indexOf('const visibleCustomFieldDefMap = new Map(')
const mapEnd = source.indexOf('const persistedFieldOptionMap', mapStart)
assert.notEqual(mapStart, -1, '没有找到自定义字段列定义映射。')
assert.notEqual(mapEnd, -1, '没有找到字段配置映射起点。')

const mapSource = source.slice(mapStart, mapEnd)
assert.doesNotMatch(
  mapSource,
  /tasklist\?\.custom_fields/,
  '自定义字段列定义不能从 tasklist.custom_fields 派生，否则接口刷新后会因为父级状态滞后少渲染字段。',
)
assert.match(
  mapSource,
  /apiToCustomFieldDef\(field\)/,
  '自定义字段列定义应该复用接口字段到前端字段的转换逻辑。',
)

console.log('custom field columns use raw fields check ok')
