import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { detectPlatform } from './utils/device'
import './index.css'

// PC 端代码按需加载，避免移动端下载 antd 等 PC 依赖
const PcApp = lazy(() => import('./pc/App'))

const isPc = detectPlatform() === 'pc'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPc ? (
      <Suspense fallback={<div className="app-loading">加载中...</div>}>
        <PcApp />
      </Suspense>
    ) : (
      <RouterProvider router={router} />
    )}
  </StrictMode>,
)
