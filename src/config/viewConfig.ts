import type { NavKey } from '@/components/Sidebar'

export type ColumnKey =
  | 'title'
  | 'priority'
  | 'assignee'
  | 'start'
  | 'due'
  | 'creator'
  | 'created'
  | 'estimate'

export type TabKey = 'list' | 'board' | 'report'

export interface ViewConfig {
  title: string
  /** 顶部 tabs；为空则不显示 tabs */
  tabs: TabKey[]
  /** 列表视图是否按 Section 分组 */
  groupBySection: boolean
  /** 是否显示表头标题区 */
  showHeaderTitle?: boolean
  /** 是否展示列表头部 tab 名 */
  tabLabel?: string
  /** 是否展示列头 */
  showColumnHeader?: boolean
  /** 空清单文案 */
  emptyState?: {
    title: string
    actionLabel?: string
  }
  /** 工具栏按钮 */
  toolbar: {
    showCreate: boolean
    /** 左侧第一个筛选状态按钮的文本，不传则不显示 */
    statusFilterLabel?: '全部任务' | '未完成'
    filterBadgeCount?: number
    showSort: boolean
    sortLabel?: string
    showGroup: boolean
    groupLabel?: string
    showSubtask: boolean
    showFieldConfig: boolean
  }
  /** 显示哪些列 */
  columns: ColumnKey[]
}

// 默认配置（清单视图用）
const defaultTasklistConfig = (name: string): ViewConfig => ({
  title: name,
  tabs: [],
  groupBySection: true,
  showHeaderTitle: true,
  tabLabel: '列表',
  showColumnHeader: true,
  toolbar: {
    showCreate: false,
    statusFilterLabel: '全部任务',
    filterBadgeCount: 0,
    showSort: true,
    sortLabel: '截止时间',
    showGroup: false,
    showSubtask: false,
    showFieldConfig: false,
  },
  columns: ['title', 'priority', 'assignee', 'start', 'due', 'creator'],
  emptyState: {
    title: '默认分组',
    actionLabel: '新建任务',
  },
})

const configs: Record<string, ViewConfig> = {
  'my-assigned': {
    title: '我负责的',
    tabs: ['list', 'board', 'report'],
    groupBySection: true,
    toolbar: {
      showCreate: false,
      statusFilterLabel: '全部任务',
      showSort: true,
      sortLabel: '截止时间',
      showGroup: true,
      groupLabel: '任务分组',
      showSubtask: false,
      showFieldConfig: true,
    },
    columns: ['title', 'start', 'due', 'creator', 'created'],
  },
  'my-followed': {
    title: '我关注的',
    tabs: ['list'],
    groupBySection: false,
    showHeaderTitle: true,
    tabLabel: '列表',
    showColumnHeader: true,
    toolbar: {
      showCreate: false,
      statusFilterLabel: '未完成',
      showSort: true,
      sortLabel: '截止时间',
      showGroup: true,
      groupLabel: '无分组',
      showSubtask: false,
      showFieldConfig: true,
    },
    columns: ['title', 'assignee', 'start', 'due', 'creator'],
  },
  'from-project': {
    title: '来自飞书项目',
    tabs: [],
    groupBySection: true, // 按"其他"等任务来源分组
    showHeaderTitle: true,
    tabLabel: '列表',
    showColumnHeader: true,
    toolbar: {
      showCreate: false,
      statusFilterLabel: '全部任务',
      filterBadgeCount: 1,
      showSort: true,
      sortLabel: '截止时间',
      showGroup: true,
      groupLabel: '任务来源',
      showSubtask: false,
      showFieldConfig: true,
    },
    columns: ['title', 'assignee', 'estimate', 'start', 'due', 'creator'],
  },
  'all-tasks': {
    title: '全部任务',
    tabs: ['list', 'report'],
    groupBySection: false,
    showHeaderTitle: true,
    tabLabel: '列表',
    showColumnHeader: true,
    toolbar: {
      showCreate: false,
      statusFilterLabel: '全部任务',
      showSort: true,
      sortLabel: '截止时间',
      showGroup: true,
      groupLabel: '无分组',
      showSubtask: false,
      showFieldConfig: true,
    },
    columns: ['title', 'assignee', 'start', 'due', 'creator'],
  },
  'my-created': {
    title: '我创建的',
    tabs: ['list', 'report'],
    groupBySection: false,
    showHeaderTitle: true,
    tabLabel: '列表',
    showColumnHeader: true,
    toolbar: {
      showCreate: false,
      statusFilterLabel: '未完成',
      showSort: true,
      sortLabel: '截止时间',
      showGroup: true,
      groupLabel: '无分组',
      showSubtask: false,
      showFieldConfig: true,
    },
    columns: ['title', 'assignee', 'start', 'due', 'created'],
  },
  'my-assigned-quick': {
    title: '我分配的',
    tabs: ['list'],
    groupBySection: false,
    showHeaderTitle: true,
    tabLabel: '列表',
    showColumnHeader: true,
    toolbar: {
      showCreate: false,
      statusFilterLabel: '全部任务',
      showSort: true,
      sortLabel: '截止时间',
      showGroup: true,
      groupLabel: '无分组',
      showSubtask: false,
      showFieldConfig: true,
    },
    columns: ['title', 'assignee', 'start', 'due', 'created'],
  },
  done: {
    title: '已完成',
    tabs: ['list'],
    groupBySection: false,
    showHeaderTitle: true,
    tabLabel: '列表',
    showColumnHeader: true,
    toolbar: {
      showCreate: false,
      statusFilterLabel: '全部任务',
      showSort: true,
      sortLabel: '完成时间',
      showGroup: true,
      groupLabel: '无分组',
      showSubtask: false,
      showFieldConfig: true,
    },
    columns: ['title', 'assignee', 'start', 'due', 'created'],
  },
}

export function getViewConfig(nav: NavKey, tasklistName?: string): ViewConfig | null {
  if (typeof nav === 'object' && nav.type === 'tasklist') {
    return defaultTasklistConfig(tasklistName ?? '任务清单')
  }
  if (typeof nav === 'string') {
    return configs[nav] ?? null
  }
  return null
}
