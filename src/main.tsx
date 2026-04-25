import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App.tsx'
import './index.css'
import { initFetchInterceptor } from './utils/http'

// 初始化全局 fetch 拦截器，自动添加认证 headers
initFetchInterceptor()

dayjs.locale('zh-cn')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
