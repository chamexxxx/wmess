import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // 0.0.0.0 — доступ с устройств в локальной сети
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    // Проксируем на BFF (WMess.Web), а НЕ напрямую на API: BFF держит сессию в куке и
    // подставляет Bearer. Прямой проксинг на :5241 сломал бы авторизацию (API — только JWT).
    // target остаётся localhost: BFF на этой же машине; браузер ходит только на Vite.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5100',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://127.0.0.1:5100',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
