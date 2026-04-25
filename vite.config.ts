import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/task-feis/',  // 生产环境基础路径
  server: {
    host: true,
    port: 5177,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 按基础依赖拆包，避免入口 chunk 过大触发构建告警
          if (!id.includes('node_modules')) {
            return
          }
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react-vendor'
          }
          if (id.includes('/node_modules/react-router/')) {
            return 'router-vendor'
          }
          if (
            id.includes('/node_modules/@ant-design/icons/') ||
            id.includes('/node_modules/@ant-design/icons-svg/')
          ) {
            return 'antd-icons'
          }
          if (id.includes('/node_modules/@ant-design/cssinjs/')) {
            return 'antd-style'
          }
          if (
            id.includes('/node_modules/antd/es/config-provider/') ||
            id.includes('/node_modules/antd/es/theme/') ||
            id.includes('/node_modules/antd/es/style/') ||
            id.includes('/node_modules/antd/es/locale/') ||
            id.includes('/node_modules/antd/es/_util/')
          ) {
            return 'antd-base'
          }
          if (
            id.includes('/node_modules/antd/es/button/') ||
            id.includes('/node_modules/antd/es/input/') ||
            id.includes('/node_modules/antd/es/input-number/') ||
            id.includes('/node_modules/antd/es/checkbox/') ||
            id.includes('/node_modules/antd/es/select/') ||
            id.includes('/node_modules/antd/es/date-picker/') ||
            id.includes('/node_modules/antd/es/tag/') ||
            id.includes('/node_modules/antd/es/badge/') ||
            id.includes('/node_modules/antd/es/segmented/') ||
            id.includes('/node_modules/antd/es/divider/')
          ) {
            return 'antd-controls'
          }
          if (
            id.includes('/node_modules/antd/es/layout/') ||
            id.includes('/node_modules/antd/es/menu/') ||
            id.includes('/node_modules/antd/es/dropdown/') ||
            id.includes('/node_modules/antd/es/tooltip/') ||
            id.includes('/node_modules/antd/es/popover/') ||
            id.includes('/node_modules/antd/es/space/') ||
            id.includes('/node_modules/antd/es/typography/') ||
            id.includes('/node_modules/antd/es/avatar/') ||
            id.includes('/node_modules/antd/es/skeleton/') ||
            id.includes('/node_modules/antd/es/empty/')
          ) {
            return 'antd-display'
          }
          if (
            id.includes('/node_modules/antd/es/tree/') ||
            id.includes('/node_modules/antd/es/message/') ||
            id.includes('/node_modules/antd/es/modal/') ||
            id.includes('/node_modules/antd/es/notification/')
          ) {
            return 'antd-feedback'
          }
          if (
            id.includes('/node_modules/@rc-component/form/') ||
            id.includes('/node_modules/@rc-component/input/') ||
            id.includes('/node_modules/@rc-component/textarea/') ||
            id.includes('/node_modules/@rc-component/input-number/') ||
            id.includes('/node_modules/@rc-component/select/') ||
            id.includes('/node_modules/@rc-component/checkbox/') ||
            id.includes('/node_modules/@rc-component/switch/')
          ) {
            return 'antd-form'
          }
          if (
            id.includes('/node_modules/@rc-component/table/') ||
            id.includes('/node_modules/@rc-component/tabs/') ||
            id.includes('/node_modules/@rc-component/menu/') ||
            id.includes('/node_modules/@rc-component/tree/') ||
            id.includes('/node_modules/@rc-component/dropdown/') ||
            id.includes('/node_modules/@rc-component/tooltip/') ||
            id.includes('/node_modules/@rc-component/dialog/') ||
            id.includes('/node_modules/@rc-component/trigger/')
          ) {
            return 'antd-layout'
          }
          if (
            id.includes('/node_modules/@rc-component/picker/') ||
            id.includes('/node_modules/@rc-component/tour/') ||
            id.includes('/node_modules/@rc-component/notification/') ||
            id.includes('/node_modules/@rc-component/image/') ||
            id.includes('/node_modules/@rc-component/progress/') ||
            id.includes('/node_modules/@rc-component/steps/') ||
            id.includes('/node_modules/@rc-component/qrcode/') ||
            id.includes('/node_modules/@rc-component/mentions/') ||
            id.includes('/node_modules/@rc-component/cascader/') ||
            id.includes('/node_modules/@rc-component/tree-select/') ||
            id.includes('/node_modules/@rc-component/pagination/') ||
            id.includes('/node_modules/@rc-component/motion/') ||
            id.includes('/node_modules/@rc-component/util/') ||
            id.includes('/node_modules/@rc-component/context/') ||
            id.includes('/node_modules/@rc-component/portal/') ||
            id.includes('/node_modules/@rc-component/overflow/') ||
            id.includes('/node_modules/@rc-component/mutate-observer/') ||
            id.includes('/node_modules/@rc-component/resize-observer/')
          ) {
            return 'antd-misc'
          }
          if (id.includes('/node_modules/antd/es/') || id.includes('/node_modules/antd/lib/')) {
            return 'antd-misc'
          }
          if (id.includes('/node_modules/@rc-component/')) {
            return 'antd-misc'
          }
          if (id.includes('/node_modules/dayjs/')) {
            return 'dayjs-vendor'
          }
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
})
