import { createBrowserRouter } from 'react-router-dom'
import AuthGuard from '@/components/AuthGuard'
import GroupSelect from '@/pages/GroupSelect'
import Detect from '@/pages/Detect'
import Verify from '@/pages/Verify'
import Login from '@/pages/Login'

/**
 * 移动端路由。
 * PC 端入口在 src/main.tsx 中按设备分流到 src/pc。
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <GroupSelect />
      </AuthGuard>
    )
  },
  {
    path: '/detect',
    element: (
      <AuthGuard>
        <Detect />
      </AuthGuard>
    )
  },
  {
    path: '/verify/:id',
    element: (
      <AuthGuard>
        <Verify />
      </AuthGuard>
    )
  }
])
