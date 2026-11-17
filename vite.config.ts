import path from 'node:path'
import os from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
// 同一份产物同时承载 PC 端（antd）与移动端（antd-mobile）：
// - PC 端所有请求走同源 /api、/files，由本服务器反代到后端（默认 127.0.0.1:8000）
// - 移动端开发环境走同源 /mock-api，反代到 Mock 服务（3000），手机通过局域网 IP 访问也能正常取数
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000'
  const mockTarget = env.VITE_MOCK_PROXY_TARGET || 'http://127.0.0.1:3000'
  const proxy = {
    '/api': { target, changeOrigin: true },
    '/files': { target, changeOrigin: true },
    '/mock-api': {
      target: mockTarget,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/mock-api/, '/api')
    }
  }

  return {
    plugins: [react()],
    // 缓存目录放到系统临时目录，避免 Desktop 目录写入受限导致依赖预构建失败
    cacheDir: path.join(os.tmpdir(), 'newagent-vite-cache'),
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src')
      }
    },
    server: {
      port: 5173,
      proxy
    },
    preview: {
      port: 4173,
      proxy
    }
  }
})
