import { request } from './index'

/** 数据核对组（与 PC 端 /api/groups 返回结构一致） */
export interface CoreGroup {
  id: number
  name: string
  remark?: string
  row_count: number
  batch_count: number
}

/** 核验指针可选项（与 PC 端 /api/groups/{id}/target-options 一致） */
export interface TargetOptions {
  lots: string[]
  gtins: string[]
}

/** 获取数据核对组列表 */
export async function fetchGroups(): Promise<CoreGroup[]> {
  const res: any = await request.get('/groups')
  return res.items || []
}

/** 获取某核对组的核验指针可选项（生产批号 / GTIN） */
export async function fetchTargetOptions(groupId: number): Promise<TargetOptions> {
  const res: any = await request.get(`/groups/${groupId}/target-options`)
  return { lots: res.lots || [], gtins: res.gtins || [] }
}

/** 上传基线照片并 AI 识别（与 PC 端同一接口）：task_order 任务单 / vendor_code 厂商代码 */
export async function uploadBaseline(groupId: number, carrier: 'task_order' | 'vendor_code', file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const res: any = await request.post(`/groups/${groupId}/baseline/${carrier}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res
}

/** 获取核对组详情（含基线与任务单 × 厂商代码交叉校验结果） */
export async function getGroupBaseline(groupId: number) {
  const res: any = await request.get(`/groups/${groupId}`)
  return res
}

const GROUP_KEY = 'new_agent_group'

/** 记录当前选择的数据核对组，供后续页面使用 */
export function setSelectedGroup(group: { id: number; name: string }) {
  localStorage.setItem(GROUP_KEY, JSON.stringify(group))
}

export function getSelectedGroup(): { id: number; name: string } | null {
  try {
    const raw = localStorage.getItem(GROUP_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
