import { useEffect } from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router'
import ConfigProvider from 'antd/es/config-provider'
import zhCN from 'antd/es/locale/zh_CN'
import TaskListPage from '@/pages/TaskList'

// 检测是否在 iframe 环境中并设置 basename
const isDev = import.meta.env.DEV
let basename = '/'
if (!isDev && typeof window !== 'undefined') {
  // 生产环境：检查当前 URL 是否以 /task-feis 开头
  const pathname = window.location.pathname
  if (pathname.startsWith('/task-feis')) {
    basename = '/task-feis'
  }
}

// URL 参数恢复组件：在子应用刷新时从 sessionStorage 恢复 user_id 和 user_name
function UrlParamsRestorer() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // 检查当前 URL 是否有 user_id 和 user_name 参数
    const currentSearchParams = new URLSearchParams(location.search)
    const hasUserId = currentSearchParams.has('user_id')
    const hasUserName = currentSearchParams.has('user_name')

    console.log('[TaskFeis UrlParamsRestorer] hasUserId:', hasUserId, 'hasUserName:', hasUserName)

    // 如果参数缺失，尝试从 sessionStorage 恢复
    if (!hasUserId || !hasUserName) {
      const savedUserId = sessionStorage.getItem('taskfeis_user_id')
      const savedUserName = sessionStorage.getItem('taskfeis_user_name')

      console.log('[TaskFeis UrlParamsRestorer] sessionStorage 中的值:', { savedUserId, savedUserName })

      if (savedUserId || savedUserName) {
        // 构建新的 URL
        const newSearchParams = new URLSearchParams(location.search)
        if (savedUserId && !hasUserId) {
          newSearchParams.set('user_id', savedUserId)
        }
        if (savedUserName && !hasUserName) {
          newSearchParams.set('user_name', savedUserName)
        }

        // 重定向到带参数的 URL（使用 replace 避免历史记录堆积）
        const queryString = newSearchParams.toString()
        const newPath = queryString ? `${location.pathname}?${queryString}` : location.pathname
        console.log('[TaskFeis UrlParamsRestorer] 🔄 重定向到:', newPath)
        
        // 使用 setTimeout 确保在当前渲染周期完成后执行导航
        setTimeout(() => {
          navigate(newPath, { replace: true })
        }, 0)
      } else {
        console.warn('[TaskFeis UrlParamsRestorer] ⚠️ URL 参数丢失且 sessionStorage 中没有保存的参数')
        console.warn('[TaskFeis UrlParamsRestorer] 这可能是因为用户直接访问了 /app-taskfeis 而没有通过主应用')
      }
    } else {
      // 参数存在，保存到 sessionStorage 以备后用
      console.log('[TaskFeis UrlParamsRestorer] ✅ URL 参数完整，保存到 sessionStorage')
      sessionStorage.setItem('taskfeis_user_id', currentSearchParams.get('user_id') || '')
      sessionStorage.setItem('taskfeis_user_name', currentSearchParams.get('user_name') || '')
    }
  }, [location.search, location.pathname, navigate])

  return null
}

export default function App() {
  console.log('[TaskFeis App] basename:', basename)
  return (
    <BrowserRouter basename={basename}>
      <ConfigProvider locale={zhCN}>
        <UrlParamsRestorer />
        <TaskListPage />
      </ConfigProvider>
    </BrowserRouter>
  )
}
