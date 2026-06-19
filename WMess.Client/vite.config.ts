import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/bff': { target: 'http://localhost:5100', changeOrigin: true },
      '/api': { target: 'http://localhost:5100', changeOrigin: true },
    },
  },
})
