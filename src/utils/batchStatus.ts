/** 批次状态标签色（antd-mobile Tag / antd Tag 通用语义） */
export type BatchStatusColor = 'default' | 'primary' | 'success' | 'warning' | 'danger'

/** 与 PC 端一致的状态文案 */
export const STATUS_META: Record<string, { color: BatchStatusColor; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  ready: { color: 'primary', text: '待核验' },
  passed: { color: 'success', text: '通过(解锁)' },
  locked: { color: 'danger', text: '异常锁定' },
  rechecking: { color: 'warning', text: '整改复检中' },
  closed: { color: 'default', text: '已关闭' }
}

/** 取状态文案，未知状态回落为「待核验」 */
export function statusMeta(status?: string) {
  return STATUS_META[status || 'ready'] || STATUS_META.ready
}
