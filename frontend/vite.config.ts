import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, os pedidos a /api vão para o backend local (uvicorn).
    proxy: { '/api': 'http://localhost:8000' },
  },
})
