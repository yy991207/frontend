import { readFileSync } from 'node:fs'

const taskListFile = 'src/pages/TaskList.tsx'
const taskTableFile = 'src/components/TaskTable/index.tsx'
const taskListSource = readFileSync(new URL(`../${taskListFile}`, import.meta.url), 'utf8')
const taskTableSource = readFileSync(new URL(`../${taskTableFile}`, import.meta.url), 'utf8')

const failures = []

if (taskListSource.includes('if (loading) {\n      return (')) {
  failures.push(`${taskListFile}: 任务刷新时不能直接返回骨架屏，否则 TaskTable 会卸载，保存视图的未保存状态会丢。`)
}

if (!taskListSource.includes('loading={loading}')) {
  failures.push(`${taskListFile}: TaskTable 需要接收父页面加载态，刷新任务时由表格内部展示加载占位。`)
}

if (!taskTableSource.includes('loading?: boolean')) {
  failures.push(`${taskTableFile}: TaskTableProps 还没有声明 loading，无法在保持挂载的同时展示加载态。`)
}

if (!taskTableSource.includes('shouldShowTaskLoading')) {
  failures.push(`${taskTableFile}: TaskTable 还没有独立任务加载态，保存视图初始化和任务刷新加载态容易混在一起。`)
}

if (failures.length > 0) {
  console.error('发现保存视图脏状态刷新链路风险：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('保存视图脏状态刷新链路已保持挂载。')
