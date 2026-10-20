import { expect, test } from '@playwright/test'
import { openFromSidebar, resetData, signIn } from './support.ts'

test.beforeEach(async ({ page }) => {
  resetData()
  await signIn(page)
})

test('avalia um objetivo, muda a nota e anula a avaliação', async ({ page }) => {
  // "Perder 5 kg" terminou há 3 dias: está em "Por avaliar", no painel.
  const review = page.locator('.review-item').filter({ hasText: 'Perder 5 kg' })
  await review.getByRole('button', { name: 'Sucedido', exact: true }).click()
  await review.getByLabel('Nota (opcional)').fill('Menos 5 kg em 3 meses.')
  await review.getByRole('button', { name: 'Guardar resultado' }).click()
  await expect(review).toBeHidden()

  await openFromSidebar(page, 'Histórico')
  await expect(page.getByText('Menos 5 kg em 3 meses.')).toBeVisible()

  // A nota muda-se depois, no formulário de edição.
  await page.getByRole('button', { name: 'Editar "Perder 5 kg"' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar objetivo' })
  await dialog.getByLabel(/Nota do resultado/).fill('Menos 6 kg, afinal.')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Menos 6 kg, afinal.')).toBeVisible()

  // Anular a avaliação devolve-o ao "Por avaliar".
  await page.getByRole('button', { name: 'Anular a avaliação de "Perder 5 kg"' }).click()
  await expect(page.getByText('Menos 6 kg, afinal.')).toBeHidden()
  await openFromSidebar(page, 'Painel')
  await expect(page.locator('.review-item').filter({ hasText: 'Perder 5 kg' })).toBeVisible()
})
