import { create } from 'zustand'
import { request } from '@/api'
import { clearToken, getToken, setToken } from '@/utils/storage'

interface UserInfo {
  userId: string
  userName: string
  avatar: string
}

interface UserState {
  token: string | null
  userInfo: UserInfo | null
  isLoggedIn: boolean
  loginWithCode: (code: string) => Promise<void>
  loginWithPassword: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useUserStore = create<UserState>((set) => ({
  token: getToken(),
  userInfo: null,
  isLoggedIn: !!getToken(),

  loginWithCode: async (code: string) => {
    // 企微授权 code 换取登录态（生产环境企微入口使用）
    const data: any = await request.post('/auth/wx-code', { code })
    setToken(data.token)
    set({
      token: data.token,
      userInfo: data as UserInfo,
      isLoggedIn: true
    })
  },

  /** 账号密码登录：与 PC 端 /api/auth/login 同一接口，数据同源 */
  loginWithPassword: async (username: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const data: any = await request.post('/auth/login', form)
    setToken(data.access_token)
    set({
      token: data.access_token,
      userInfo: {
        userId: data.user?.username ?? username,
        userName: data.user?.real_name || data.user?.username || username,
        avatar: data.user?.avatar || ''
      },
      isLoggedIn: true
    })
  },

  logout: () => {
    clearToken()
    set({ token: null, userInfo: null, isLoggedIn: false })
  }
}))
