import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,          // слушать на всех интерфейсах (0.0.0.0) — доступ с других устройств в сети
    port: 5173,
    strictPort: true,
    allowedHosts: true,  // принимать запросы по IP/hostname машины, а не только по localhost
    // Проксируем на BFF (WMess.Web), а НЕ напрямую на API: BFF держит сессию в куке и
    // подставляет Bearer. Прямой проксинг на :5241 сломал бы авторизацию (API — только JWT).
    proxy: {
      '/api': {
        target: 'http://localhost:5100',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5100',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
