import { expect, test } from '@playwright/test'
import { addDays, openFromSidebar, resetData, signIn, today } from './support.ts'

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

test('avalia um objetivo antes da data limite e muda o dia em que terminou', async ({ page }) => {
  // "Meditar 10 minutos por dia" ainda tem 18 dias pela frente.
  await openFromSidebar(page, 'Objetivos')
  await page.getByRole('button', { name: 'Editar "Meditar 10 minutos por dia"' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar objetivo' })
  await expect(dialog.getByLabel('Em curso')).toBeChecked()
  await expect(dialog.getByLabel('Data em que terminou')).toHaveCount(0)
  await dialog.getByText('Sucedido', { exact: true }).click()
  // Por omissão, terminou hoje; não pode ser depois.
  await expect(dialog.getByLabel('Data em que terminou')).toHaveValue(today())
  await expect(dialog.getByLabel('Data em que terminou')).toHaveAttribute('max', today())
  await dialog.getByLabel('Data em que terminou').fill(addDays(today(), -2))
  await dialog.getByLabel(/Nota do resultado/).fill('90 dias seguidos, antes do prazo.')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()

  await openFromSidebar(page, 'Histórico')
  await expect(page.getByText('90 dias seguidos, antes do prazo.')).toBeVisible()

  // O dia em que terminou muda-se depois, no mesmo formulário.
  await page.getByRole('button', { name: 'Editar "Meditar 10 minutos por dia"' }).click()
  await expect(dialog.getByLabel('Sucedido', { exact: true })).toBeChecked()
  await expect(dialog.getByLabel('Data em que terminou')).toHaveValue(addDays(today(), -2))
  await dialog.getByLabel('Data em que terminou').fill(addDays(today(), -5))
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Editar "Meditar 10 minutos por dia"' }).click()
  await expect(dialog.getByLabel('Data em que terminou')).toHaveValue(addDays(today(), -5))

  // Voltar a "Em curso" anula a avaliação: sai do histórico.
  await dialog.getByText('Em curso', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('90 dias seguidos, antes do prazo.')).toBeHidden()
})

test('tenta outra vez um objetivo não sucedido, com datas novas', async ({ page }) => {
  await openFromSidebar(page, 'Histórico')
  await page.getByRole('button', { name: 'Tentar outra vez "Deixar de fumar"' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tentar outra vez' })
  await expect(dialog.getByLabel('Objetivo')).toHaveValue('Deixar de fumar')
  await expect(dialog.getByLabel('Passo 1', { exact: true })).toHaveValue('Marcar consulta de cessação')
  await expect(dialog.getByLabel('Passo 2', { exact: true })).toHaveValue('30 dias sem fumar')
  // Começa hoje e dura o mesmo que o original (125 dias).
  await expect(dialog.getByLabel('Início')).toHaveValue(today())
  await expect(dialog.getByLabel('Data limite')).toHaveValue(addDays(today(), 125))
  await dialog.getByRole('button', { name: 'Criar objetivo' }).click()
  await expect(dialog).toBeHidden()

  // O original fica no histórico; o novo está em curso.
  await expect(page.getByText('Recaída ao fim de 2 meses.', { exact: false })).toBeVisible()
  await openFromSidebar(page, 'Objetivos')
  await page.getByRole('button', { name: /^Em curso/ }).click()
  await expect(page.getByRole('heading', { name: 'Deixar de fumar' })).toHaveCount(1)

  // Nos que correram bem, o botão chama-se "Repetir".
  await page.getByRole('button', { name: /^Todos/ }).click()
  await page.getByRole('button', { name: 'Repetir "Viagem ao Japão"' }).click()
  await expect(page.getByRole('dialog', { name: 'Repetir objetivo' })).toBeVisible()
})
