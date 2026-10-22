import { expect, test } from '@playwright/test'
import { resetData, signIn } from './support.ts'

test.beforeEach(async ({ page }) => {
  resetData()
  await signIn(page)
})

test('cria um objetivo recorrente e marca o dia de hoje', async ({ page }) => {
  await page.locator('.topbar').getByRole('button', { name: 'Novo objetivo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo objetivo' })
  await dialog.getByLabel('Objetivo').fill('Ler 20 páginas')
  await dialog.getByLabel('Repetir todas as semanas').check()
  await dialog.getByLabel('Vezes por semana').selectOption({ label: '1 vez por semana' })
  // A percentagem passa a ser a das semanas: sem barra nem "Calcular pelos passos feitos".
  await expect(dialog.getByText(/É a percentagem de semanas cumpridas/)).toBeVisible()
  await expect(dialog.getByLabel('Calcular pelos passos feitos')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Criar objetivo' }).click()
  await expect(dialog).toBeHidden()

  const card = page.locator('.goal-card').filter({ hasText: 'Ler 20 páginas' })
  const progress = card.getByRole('progressbar')
  await expect(card.getByText('Esta semana: 0 de 1')).toBeVisible()
  // Começou hoje: só hoje se pode marcar (os dias antes do início e os que aí vêm, não).
  await expect(card.locator('.week-day:enabled')).toHaveCount(1)
  const todayButton = card.getByRole('button', { name: /, hoje$/ })
  await todayButton.click()
  await expect(todayButton).toHaveAttribute('aria-pressed', 'true')
  await expect(card.getByText('Esta semana: 1 de 1')).toBeVisible()
  await expect(progress).not.toHaveAttribute('aria-valuenow', '0')

  await page.reload()
  await expect(todayButton).toHaveAttribute('aria-pressed', 'true')
  await todayButton.click()
  await expect(card.getByText('Esta semana: 0 de 1')).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuenow', '0')

  // Deixa de ser recorrente: a semana sai do cartão.
  await card.getByRole('button', { name: 'Editar "Ler 20 páginas"' }).click()
  const editing = page.getByRole('dialog', { name: 'Editar objetivo' })
  await expect(editing.getByLabel('Vezes por semana')).toHaveValue('1')
  await editing.getByLabel('Repetir todas as semanas').uncheck()
  await editing.getByRole('button', { name: 'Guardar' }).click()
  await expect(editing).toBeHidden()
  await expect(card.getByText(/Esta semana/)).toHaveCount(0)
})
