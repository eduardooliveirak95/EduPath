import { expect, test } from '@playwright/test'
import { DEMO, openFromSidebar, resetData, signIn } from './support.ts'

test.beforeEach(resetData)

test('entra na conta e sai', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(DEMO.name)

  await openFromSidebar(page, 'Terminar sessão')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  // Sem sessão, recarregar continua no ecrã de entrada.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})

test('password errada e bloqueio depois de 5 tentativas', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Email').fill(DEMO.email)
  const password = page.getByLabel('Password', { exact: true })
  const enter = page.getByRole('button', { name: 'Entrar', exact: true })

  for (let attempt = 1; attempt <= 5; attempt++) {
    await password.fill(`errada-${attempt}`)
    await enter.click()
    await expect(page.getByRole('alert')).toHaveText('Email ou password errados.')
  }
  // Bloqueado: nem a password certa entra.
  await password.fill(DEMO.password)
  await enter.click()
  await expect(page.getByRole('alert')).toHaveText('Demasiadas tentativas falhadas. Espera 15 minutos e tenta outra vez.')
})
