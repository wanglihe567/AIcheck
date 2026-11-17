import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useUserStore } from '@/store/useUserStore'

interface Props {
  children: React.ReactNode
}

/** 移除 URL 上的 code，保留其他参数（如平台标识） */
function stripCode() {
  const params = new URLSearchParams(window.location.search)
  params.delete('code')
  const search = params.toString()
  const cleanUrl = window.location.pathname + (search ? `?${search}` : '') + window.location.hash
  window.history.replaceState({}, '', cleanUrl)
}

export default function AuthGuard({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isLoggedIn, loginWithCode } = useUserStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code')

    // 已登录：code 已无意义，直接清掉，避免残留在地址栏
    if (isLoggedIn) {
      if (code) stripCode()
      setLoading(false)
      return
    }

    // 正常流程：入口带 code，用 code 换取登录态
    if (code) {
      loginWithCode(code)
        .then(stripCode)
        .catch(() => {
          navigate('/login', { replace: true })
        })
        .finally(() => setLoading(false))
      return
    }

    // 开发环境：URL 无 code 时直接用 Mock 账号自动登录，便于直接查看页面效果
    if (import.meta.env.DEV) {
      loginWithCode('dev-preview')
        .catch(() => {
          navigate('/login', { replace: true })
        })
        .finally(() => setLoading(false))
      return
    }

    setLoading(false)
  }, [])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
