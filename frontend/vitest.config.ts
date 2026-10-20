import { defineConfig } from 'vitest/config'

// Testes das funções da app (src/**/*.test.ts). Os de ponta a ponta, num browser, estão em e2e/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // O fuso de Lisboa, para os testes das datas apanharem as mudanças de hora.
    env: { TZ: 'Europe/Lisbon' },
  },
})
