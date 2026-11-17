import axios from 'axios'

export const api = axios.create({ baseURL: '/' })

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear()
      if (!location.pathname.endsWith('/login')) location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export function errMsg(e: any): string {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x: any) => x.msg).join('；')
  return e?.message || '请求失败'
}

// ---------------- auth ----------------
export const login = (username: string, password: string) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  return api.post('/api/auth/login', form).then((r) => r.data)
}
export const changePassword = (old_password: string, new_password: string) =>
  api.post('/api/auth/change-password', { old_password, new_password })

// ---------------- 物料字段库 ----------------
export const getMaterialFields = () =>
  api.get('/api/material-fields').then((r) => r.data)
export const addMaterialField = (d: { carrier_type: string; field_label: string; match_type: string; is_list: boolean }) =>
  api.post('/api/material-fields', d).then((r) => r.data)
export const updateMaterialField = (id: number, d: any) =>
  api.put(`/api/material-fields/${id}`, d).then((r) => r.data)
export const deleteMaterialField = (id: number) =>
  api.delete(`/api/material-fields/${id}`).then((r) => r.data)
export const scanMaterialFields = (carrier_type: string, file: File) => {
  const fd = new FormData()
  fd.append('carrier_type', carrier_type)
  fd.append('file', file)
  return api.post('/api/material-fields/scan', fd).then((r) => r.data)
}

// ---------------- 数据核对组 ----------------
export const listGroups = () => api.get('/api/groups').then((r) => r.data)
export const createGroup = (d: { name: string; remark?: string }) =>
  api.post('/api/groups', d).then((r) => r.data)
export const updateGroup = (id: number, d: { name: string; remark?: string }) =>
  api.put(`/api/groups/${id}`, d).then((r) => r.data)
export const deleteGroup = (id: number) =>
  api.delete(`/api/groups/${id}`).then((r) => r.data)
export const getGroup = (id: number) => api.get(`/api/groups/${id}`).then((r) => r.data)
export const saveGroupRows = (id: number, rows: any[]) =>
  api.put(`/api/groups/${id}/rows`, { rows }).then((r) => r.data)
export const getGroupBaseline = (id: number) =>
  api.get(`/api/groups/${id}/baseline`).then((r) => r.data)
export const uploadBaseline = (groupId: number, carrier: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/api/groups/${groupId}/baseline/${carrier}`, fd).then((r) => r.data)
}
export const editBaseline = (groupId: number, carrier: string, data: any) =>
  api.put(`/api/groups/${groupId}/baseline/${carrier}`, { data }).then((r) => r.data)
export const getTargetOptions = (groupId: number) =>
  api.get(`/api/groups/${groupId}/target-options`).then((r) => r.data)

// ---------------- 数据核对批次 / 聊天核验 ----------------
export const listBatches = (params: any) =>
  api.get('/api/batches', { params }).then((r) => r.data)
export const createBatch = (d: { group_id: number; target_lot: string; target_gtin?: string }) =>
  api.post('/api/batches', d).then((r) => r.data)
export const getBatch = (id: number) => api.get(`/api/batches/${id}`).then((r) => r.data)
export const chatUpload = (id: number, files: File[]) => {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  return api.post(`/api/batches/${id}/chat-upload`, fd).then((r) => r.data)
}
export const chatText = (id: number, content: string) =>
  api.post(`/api/batches/${id}/chat-text`, { content }).then((r) => r.data)
export const rework = (id: number, reason: string, action: string) =>
  api.post(`/api/batches/${id}/rework`, { reason, action }).then((r) => r.data)
export const closeBatch = (id: number) =>
  api.post(`/api/batches/${id}/close`).then((r) => r.data)

// ---------------- users / audit ----------------
export const listRoles = () => api.get('/api/roles').then((r) => r.data)
export const listUsers = () => api.get('/api/users').then((r) => r.data)
export const createUser = (d: any) => api.post('/api/users', d).then((r) => r.data)
export const updateUser = (id: number, d: any) => api.put(`/api/users/${id}`, d).then((r) => r.data)
export const resetUserPassword = (id: number, new_password: string) =>
  api.post(`/api/users/${id}/reset-password`, { new_password }).then((r) => r.data)

export const listAuditLogs = (params: any) => api.get('/api/audit-logs', { params }).then((r) => r.data)
export const getStats = () => api.get('/api/stats').then((r) => r.data)

// ---------------- 常量 ----------------
export const CARRIERS = [
  { code: 'seal_sticker', name: '封口贴' },
  { code: 'aluminum_foil', name: '铝箔' },
  { code: 'box', name: '包装盒' },
  { code: 'task_order', name: '生产任务单' },
  { code: 'vendor_code', name: '厂商代码' },
]
export const CARRIER_NAME: Record<string, string> = Object.fromEntries(
  CARRIERS.map((c) => [c.code, c.name]),
)
export const MATCH_TYPES = [
  { code: 'exact', name: '完全一致' },
  { code: 'contains', name: '包含匹配' },
  { code: 'numeric', name: '数值比对' },
  { code: 'date', name: '日期比对' },
]
