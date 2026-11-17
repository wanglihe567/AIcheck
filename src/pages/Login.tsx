import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUserStore } from '@/store/useUserStore'

/** 从后端错误里提取可读信息（detail 可能为字符串或校验数组） */
function pickErrMsg(e: any): string {
  const d = e?.response?.data?.detail
  if (typeof d === 'string' && d) return d
  if (Array.isArray(d)) return d.map((x: any) => x.msg).join('；')
  return e?.response?.data?.message || '登录失败，请检查用户名或密码'
}

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { loginWithPassword, loginWithCode } = useUserStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState(searchParams.get('code') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /** 账号密码登录：与 PC 端同一后端账号、同一接口 */
  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('请输入用户名和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      await loginWithPassword(username.trim(), password)
      navigate('/', { replace: true })
    } catch (e: any) {
      setError(pickErrMsg(e))
    } finally {
      setLoading(false)
    }
  }

  /** 企微 code 登录：真实企微入口带 code 跳转时使用 */
  const handleCodeLogin = async () => {
    if (!code.trim()) {
      setError('请输入 code 参数')
      return
    }
    setLoading(true)
    setError('')
    try {
      await loginWithCode(code.trim())
      navigate('/', { replace: true })
    } catch (e: any) {
      setError(e?.response?.data?.message || 'code 登录失败')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 8 }}>登录</h2>
      <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>
        与 PC 端同一后端、同一账号，数据同源
      </p>

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名（admin / inspector / manager）"
        style={inputStyle}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码（admin123 / inspect123 / manager123）"
        style={{ ...inputStyle, marginTop: 12 }}
      />

      {error && <p style={{ color: '#ff4d4f', fontSize: 13, marginTop: 12 }}>{error}</p>}

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: '100%',
          marginTop: 20,
          padding: 12,
          background: loading ? '#ccc' : '#07c160',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '登录中...' : '登录'}
      </button>

      <div style={{ borderTop: '1px solid #eee', margin: '28px 0 20px' }} />

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="或输入企微 code 登录"
        style={inputStyle}
      />
      <button
        onClick={handleCodeLogin}
        disabled={loading}
        style={{
          width: '100%',
          marginTop: 12,
          padding: 10,
          background: '#fff',
          color: '#07c160',
          border: '1px solid #07c160',
          borderRadius: 6,
          fontSize: 14
        }}
      >
        code 登录
      </button>

      <p style={{ color: '#999', fontSize: 12, marginTop: 24, textAlign: 'center' }}>
        数据来源与 PC 端核验工作台一致
      </p>
    </div>
  )
}
