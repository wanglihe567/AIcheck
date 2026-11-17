import { request } from './index'

export type DetectStep = 1 | 2

/** 检测结论：一致通过 / 信息不一致预警 / 信息缺失·识别失败 */
export type DetectOutcome = 'pass' | 'warning' | 'failed'

/** 单条异常：异常载体 + 异常字段 + 对比内容 */
export interface DetectAnomaly {
  /** 异常载体，如「封口贴」「铝箔」「内盒」「任务单第 2 页」 */
  carrier: string
  /** 异常字段，如「生产批次号」「有效期」 */
  field: string
  /** 应为的值 */
  expected?: string
  /** 实际识别到的值 */
  actual?: string
  /** 补充说明，如「未识别到该字段」 */
  desc?: string
}

export interface DetectResult {
  outcome: DetectOutcome
  message: string
  anomalies: DetectAnomaly[]
}

export interface UploadResult {
  fileId: string
  fileName: string
}

/** 后端保存的检测进度（用于刷新恢复） */
export interface StepRecord {
  fileId: string
  fileName: string
  result: DetectResult | null
}

export interface DetectStatus {
  step1: StepRecord | null
  step2: StepRecord | null
}

/** 第一步：只上传文件，拿到 fileId */
export async function uploadDetectFile(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)

  const res: any = await request.post('/detect/upload', form)
  if (res.code !== 0) {
    throw new Error(res.message || '文件上传失败，请重试')
  }
  return res.data as UploadResult
}

/** 第二步：点击「检测」后调用。mock 仅用于联调时指定结果档位 */
export async function checkDetect(
  step: DetectStep,
  fileId: string,
  mock?: string
): Promise<DetectResult> {
  const res: any = await request.post('/detect/check', { step, fileId, mock })
  if (res.code !== 0) {
    throw new Error(res.message || '检测失败，请重试')
  }
  return res.data as DetectResult
}

/** 查询当前检测进度 */
export async function fetchDetectStatus(): Promise<DetectStatus> {
  const res: any = await request.get('/detect/status')
  if (res.code !== 0) {
    throw new Error(res.message || '获取检测状态失败')
  }
  return res.data as DetectStatus
}
