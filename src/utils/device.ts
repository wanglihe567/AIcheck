/**
 * 设备 / 环境判断
 *
 * 关键点：不要用屏幕宽度判断 PC 与移动端。
 * 企业微信 PC 客户端窗口可以拉得很窄，宽度判断会误判。
 * 统一用 UA 判断，企微两端 UA 都包含 wxwork。
 */

function ua() {
  return navigator.userAgent.toLowerCase()
}

/** 是否在（移动端或 PC 端）企业微信客户端内 */
export function isWework() {
  return /wxwork/i.test(ua())
}

/** 是否移动端设备 */
export function isMobile() {
  const u = ua()
  const mobile = /android|iphone|ipod|ipad|harmonyos|mobile/i.test(u)
  // iPadOS 13+ 的 Safari 会伪装成 Macintosh，这里按桌面端处理
  const desktop = /windows nt|macintosh|linux x86_64/i.test(u)
  return mobile && !desktop
}

/**
 * 平台判定。开发环境支持 ?force=mobile / ?force=pc 便于在电脑上调试移动端 UI。
 */
export function detectPlatform(): 'mobile' | 'pc' {
  if (import.meta.env.DEV) {
    const force = new URLSearchParams(window.location.search).get('force')
    if (force === 'mobile' || force === 'pc') return force
  }
  return isMobile() ? 'mobile' : 'pc'
}
