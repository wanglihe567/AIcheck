import axios from 'axios'
import { clearToken, getToken } from '@/utils/storage'

export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api'
})

request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    // 与 PC 端一致：登录态失效时清除 token 并回到登录页
    if (err.response?.status === 401) {
      clearToken()
      if (!location.pathname.endsWith('/login')) location.href = '/login'
    }
    return Promise.reject(err)
  }
)
