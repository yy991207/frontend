import { readFileSync } from 'node:fs'

const file = 'src/components/TaskTable/index.tsx'
const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const failures = []

if (source.includes('<div className="cell cell-title" onClick={(e) => e.stopPropagation()}>')) {
  failures.push(`${file}: 标题整格还在阻止冒泡，点标题区域空白处不会打开任务详情。`)
}

if (!source.includes('className={task.status === \'done\' ? \'done-text\' : \'title-text\'}')) {
  failures.push(`${file}: 没找到标题文字节点，无法确认是否只在文字上保留编辑点击。`)
}

if (!source.includes('setEditingName(true)')) {
  failures.push(`${file}: 标题文字还没有保留单独进入编辑态的点击逻辑。`)
}

if (failures.length > 0) {
  console.error('发现任务行详情点击逻辑还没修好：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('任务行空白区点击已可打开详情。')
