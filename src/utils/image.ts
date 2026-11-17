/** 图片校验、PDF 校验、base64 转换、压缩 */

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_PDF_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const PDF_TYPE = 'application/pdf'

/** 是否为 PDF 文件（部分浏览器 type 为空，兜底看后缀） */
export function isPdfFile(file: File) {
  return file.type === PDF_TYPE || /\.pdf$/i.test(file.name)
}

/** 校验图片（accept 只是提示，必须实际校验） */
export function validateImage(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error('仅支持 JPG / PNG / WEBP 格式')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('图片不能超过 10MB')
  }
}

/** 按模块校验文件：第二个模块额外允许 PDF */
export function validateFile(file: File, allowPdf = false) {
  if (isPdfFile(file)) {
    if (!allowPdf) throw new Error('该模块仅支持图片')
    if (file.size > MAX_PDF_SIZE) throw new Error('PDF 文件不能超过 20MB')
    return
  }
  validateImage(file)
}

/** base64 转 File（企微 getLocalImgData 返回的就是 base64） */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, base64] = dataUrl.split(',')
  const mimeMatch = /data:([^;]+)/.exec(meta)
  const mime = mimeMatch?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], fileName, { type: mime })
}

/**
 * 压缩图片：手机拍照原图动辄 3~5MB，弱网下必须压。
 * 按最长边缩放，输出 JPEG。
 */
export function compressImage(file: File, maxEdge = 1600, quality = 0.8): Promise<File> {
  // 已经很小就不折腾了
  if (file.size <= 500 * 1024) return Promise.resolve(file)

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const name = file.name.replace(/\.\w+$/, '') + '.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }

    img.src = url
  })
}
