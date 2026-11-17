import axios from 'axios'
import { isWework } from './device'
import { dataUrlToFile } from './image'

declare global {
  interface Window {
    wx: any
  }
}

export type ImageSource = 'camera' | 'album'
/** 选择入口：拍照 / 相册 / 选择文件（PDF 等） */
export type PickSource = ImageSource | 'file'

/** 动态加载企业微信 JS-SDK */
export function loadWeworkSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.wx) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://open.weixin.qq.com/connect/wwopen.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('JS-SDK 加载失败'))
    document.head.appendChild(script)
  })
}

let agentConfigPromise: Promise<void> | null = null

/**
 * 初始化 JS-SDK 配置（企微用 wx.agentConfig，不是 wx.config）。
 * 结果会缓存，避免每次调用都重新签名。
 */
export function initWeworkSDK(): Promise<void> {
  if (agentConfigPromise) return agentConfigPromise
  agentConfigPromise = (async () => {
    await loadWeworkSDK()
    const { data } = await axios.get('/api/wework/jssdk-sign', {
      params: { url: window.location.href.split('#')[0] }
    })
    await new Promise<void>((resolve, reject) => {
      window.wx.agentConfig({
        corpid: data.corpId,
        agentid: data.agentId,
        timestamp: data.timestamp,
        nonceStr: data.nonceStr,
        signature: data.signature,
        jsApiList: ['chooseImage', 'getLocalImgData', 'previewImage'],
        success: resolve,
        fail: reject
      })
    })
    sdkReady = true
  })().catch((e) => {
    // 失败后允许下次重试
    agentConfigPromise = null
    sdkReady = false
    throw e
  })
  return agentConfigPromise
}

/** 企微 chooseImage + getLocalImgData，返回可直接上传的 File */
async function pickImageByWework(source: ImageSource): Promise<File> {
  const localId = await new Promise<string>((resolve, reject) => {
    window.wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: [source],
      success: (res: any) => {
        const id = res?.localIds?.[0]
        if (id) resolve(id)
        else reject(new Error('未选择图片'))
      },
      fail: (res: any) => reject(res)
    })
  })

  const base64 = await new Promise<string>((resolve, reject) => {
    window.wx.getLocalImgData({
      localId,
      success: (res: any) => resolve(res.localData),
      fail: (res: any) => reject(res)
    })
  })

  // iOS 下返回的 base64 不带 data: 前缀，需要手动补
  const dataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`
  return dataUrlToFile(dataUrl, `wecom-${Date.now()}.jpg`)
}

/** H5 兜底：普通浏览器或企微 SDK 不可用时的降级方案 */
function pickByH5(source: PickSource, accept = 'image/*'): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (source === 'camera') {
      input.setAttribute('capture', 'environment')
    }
    input.style.display = 'none'
    document.body.appendChild(input)

    let settled = false
    const cleanup = () => {
      window.removeEventListener('focus', onFocus)
      input.remove()
    }
    // 用户取消选择时不会有 change 事件，靠窗口重新聚焦兜底
    const onFocus = () => {
      setTimeout(() => {
        if (settled) return
        if (!input.files || input.files.length === 0) {
          settled = true
          cleanup()
          reject(new Error('CANCELED'))
        }
      }, 400)
    }

    input.onchange = () => {
      settled = true
      const file = input.files?.[0]
      cleanup()
      if (file) resolve(file)
      else reject(new Error('CANCELED'))
    }

    window.addEventListener('focus', onFocus)
    input.click()
  })
}

let sdkReady = false

/** JS-SDK 是否已鉴权成功（同步判断，用于保住用户手势） */
export function isSdkReady() {
  return sdkReady
}

/** 页面挂载时预热，鉴权失败静默忽略 */
export function warmupWeworkSDK() {
  if (!isWework()) return
  initWeworkSDK().catch(() => {
    /* 失败时后续点击走 H5 兜底 */
  })
}

/**
 * 选择文件（统一入口）。
 *
 * 注意：iOS 只允许在用户手势的同一事件循环里触发 input.click()，
 * 一旦先 await 过再点，会被静默拦截（表现为「点了没反应」）。
 * 所以这里必须同步判断：SDK 没就绪就直接走 H5，不能等。
 *
 * source = 'file' 用于选择 PDF 等非图片文件，企微 chooseImage 不支持，只能走 H5。
 */
export async function pickFile(source: PickSource, accept?: string): Promise<File> {
  if (source !== 'file' && isWework() && sdkReady) {
    try {
      return await pickImageByWework(source)
    } catch (e) {
      console.warn('[wework] JS-SDK 调用失败，降级为 H5 选择', e)
    }
  }
  return pickByH5(source, accept)
}

/** 是否用户主动取消 */
export function isCanceled(e: unknown) {
  return e instanceof Error && e.message === 'CANCELED'
}
