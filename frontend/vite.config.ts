import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, os pedidos a /api vão para o backend local (uvicorn). Os testes
    // de ponta a ponta usam outra porta (API_PROXY_TARGET, em playwright.config.ts).
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8000' },
  },
})
