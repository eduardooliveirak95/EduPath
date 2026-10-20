import { defineConfig, devices } from '@playwright/test'
import { API_ENV, API_PORT, BACKEND_DIR, WEB_PORT } from './e2e/support.ts'

// Testes de ponta a ponta: o site num browser a sério, com a API e uma base de dados só para os
// testes. Correm em sequência, porque todos usam a mesma base de dados, reposta antes de cada um.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'] } },
    { name: 'telemovel', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `uv run uvicorn app.main:app --port ${API_PORT}`,
      cwd: BACKEND_DIR,
      env: API_ENV,
      url: `http://localhost:${API_PORT}/api/health`,
      timeout: 120_000,
    },
    {
      // O build de produção (com o service worker), como no site publicado.
      command: `npm run build && npx vite preview --port ${WEB_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      timeout: 120_000,
    },
  ],
})
