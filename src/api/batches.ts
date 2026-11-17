import { request } from './index'

/** 与 PC 端 /api/batches 聊天核验数据结构一致 */
export interface ChatMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  kind: 'text' | 'image' | 'result'
  content: string
  image_url?: string
  payload?: any
  created_at?: string
}

export interface Batch {
  id: number
  code: string
  group_id: number
  group_name: string
  /** ready 待核验 / passed 通过(解锁) / locked 异常锁定 / rechecking 整改复检中 / closed 已关闭 */
  status: string
  /** pass 一致通过 / inconsistent 信息不一致 / recognition_failed 识别失败 */
  conclusion: string | null
  last_round: number
  fail_reason: string
  target_lot: string
  target_gtin?: string
  messages: ChatMessage[]
  created_at?: string
}

/** 批次列表项（列表接口不返回 messages） */
export interface BatchBrief {
  id: number
  code: string
  group_id: number
  group_name?: string
  status: string
  conclusion: string | null
  last_round: number
  target_lot: string
  target_gtin?: string
  created_at?: string
}

/** 批次列表（与 PC 端 /api/batches 一致，支持 status / page / size） */
export async function fetchBatches(params?: {
  status?: string
  page?: number
  size?: number
}): Promise<{ total: number; items: BatchBrief[] }> {
  const res: any = await request.get('/batches', { params })
  return { total: res.total ?? 0, items: res.items ?? [] }
}

/** 创建数据核对批次（与 PC 同一接口） */
export async function createBatch(payload: {
  group_id: number
  target_lot: string
  target_gtin?: string
}): Promise<Batch> {
  const res: any = await request.post('/batches', payload)
  return res
}

export async function getBatch(id: number | string): Promise<Batch> {
  const res: any = await request.get(`/batches/${id}`)
  return res
}

/** 上传照片进行一轮 AI 核验（与 PC chatUpload 一致） */
export async function chatUpload(id: number | string, files: File[]): Promise<Batch> {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  const res: any = await request.post(`/batches/${id}/chat-upload`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res
}

/** 文字询问核验助手 */
export async function chatText(id: number | string, content: string): Promise<Batch> {
  const res: any = await request.post(`/batches/${id}/chat-text`, { content })
  return res
}

/** 录入异常整改，进入复检 */
export async function rework(id: number | string, reason: string, action: string): Promise<Batch> {
  const res: any = await request.post(`/batches/${id}/rework`, { reason, action })
  return res
}

/** 关闭归档 */
export async function closeBatch(id: number | string): Promise<Batch> {
  const res: any = await request.post(`/batches/${id}/close`)
  return res
}
