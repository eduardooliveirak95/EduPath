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
