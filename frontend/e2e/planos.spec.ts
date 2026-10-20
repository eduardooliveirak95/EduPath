import { expect, test } from '@playwright/test'
import { openFromSidebar, resetData, signIn } from './support.ts'

test.beforeEach(async ({ page }) => {
  resetData()
  await signIn(page)
})

test('marca um passo, acrescenta outro e fica tudo guardado', async ({ page }) => {
  await openFromSidebar(page, 'Planos')
  const step = page.getByRole('checkbox', { name: 'Chegar aos 15 km' })
  await expect(step).not.toBeChecked()
  await step.check()

  const newStep = page.getByLabel('Novo passo para "Correr uma meia maratona"')
  await newStep.fill('Comprar sapatilhas novas')
  await newStep.press('Enter')
  await expect(page.getByRole('checkbox', { name: 'Comprar sapatilhas novas' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Chegar aos 15 km' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Comprar sapatilhas novas' })).not.toBeChecked()
})

test('o progresso acompanha os passos feitos, ou fica à escolha', async ({ page }) => {
  await page.locator('.topbar').getByRole('button', { name: 'Novo objetivo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo objetivo' })
  // Nos objetivos novos, o progresso vem dos passos.
  await expect(dialog.getByLabel('Calcular pelos passos feitos')).toBeChecked()
  await dialog.getByLabel('Objetivo').fill('Aprender a nadar')
  await dialog.getByLabel('Passo 1', { exact: true }).fill('Inscrever-me na piscina')
  await dialog.getByLabel('Passo 1', { exact: true }).press('Enter')
  await dialog.getByLabel('Passo 2', { exact: true }).fill('Nadar 25 m sem parar')
  await expect(dialog.getByText('0 de 2 passos feitos.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Criar objetivo' }).click()
  await expect(dialog).toBeHidden()

  // Marcar um passo nos Planos muda logo a percentagem, e a API guarda o mesmo.
  await openFromSidebar(page, 'Planos')
  await page.getByRole('checkbox', { name: 'Inscrever-me na piscina' }).check()
  await openFromSidebar(page, 'Objetivos')
  const progress = page.getByRole('progressbar', { name: 'Progresso de Aprender a nadar' })
  await expect(progress).toHaveAttribute('aria-valuenow', '50')
  await page.reload()
  await expect(progress).toHaveAttribute('aria-valuenow', '50')

  // Ao desligar, a barra aparece na percentagem que se via, e fica a escolhida à mão.
  await page.getByRole('button', { name: 'Editar "Aprender a nadar"' }).click()
  const editing = page.getByRole('dialog', { name: 'Editar objetivo' })
  await expect(editing.getByText('1 de 2 passos feitos.')).toBeVisible()
  await editing.getByLabel('Calcular pelos passos feitos').uncheck()
  const slider = editing.getByRole('slider', { name: /Progresso atual/ })
  await expect(slider).toHaveValue('50')
  await slider.fill('80')
  await editing.getByRole('button', { name: 'Guardar' }).click()
  await expect(editing).toBeHidden()
  await expect(progress).toHaveAttribute('aria-valuenow', '80')

  await openFromSidebar(page, 'Planos')
  await page.getByRole('checkbox', { name: 'Nadar 25 m sem parar' }).check()
  await openFromSidebar(page, 'Objetivos')
  await expect(progress).toHaveAttribute('aria-valuenow', '80')
})
