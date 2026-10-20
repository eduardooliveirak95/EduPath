import { expect, test } from '@playwright/test'
import { openFromSidebar, resetData, signIn } from './support.ts'

test.beforeEach(async ({ page }) => {
  resetData()
  await signIn(page)
})

test('cria um objetivo com plano e encontra-o na pesquisa', async ({ page }) => {
  await page.locator('.topbar').getByRole('button', { name: 'Novo objetivo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo objetivo' })
  await dialog.getByLabel('Objetivo').fill('Tirar a carta de mota')
  await dialog.getByText('Aprendizagem', { exact: true }).click()
  await dialog.getByLabel('Passo 1', { exact: true }).fill('Inscrição na escola de condução')
  await dialog.getByLabel('Passo 1', { exact: true }).press('Enter') // Enter cria o passo seguinte
  await dialog.getByLabel('Passo 2', { exact: true }).fill('Exame de código')
  await dialog.getByRole('button', { name: 'Criar objetivo' }).click()
  await expect(dialog).toBeHidden()

  // A pesquisa procura também nos passos, sem ligar a acentos.
  await page.getByPlaceholder('Procurar objetivos ou planos…').fill('inscricao')
  await expect(page.getByRole('heading', { name: 'Objetivos', level: 1 })).toBeVisible()
  await expect(page.getByText('Tirar a carta de mota')).toBeVisible()
  await expect(page.getByText('Correr uma meia maratona')).toBeHidden()
})

test('edita e apaga um objetivo', async ({ page }) => {
  await openFromSidebar(page, 'Objetivos')
  await page.getByRole('button', { name: 'Editar "Ler 24 livros este ano"' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar objetivo' })
  await dialog.getByLabel('Objetivo').fill('Ler 30 livros este ano')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Ler 30 livros este ano')).toBeVisible()

  await page.getByRole('button', { name: 'Editar "Ler 30 livros este ano"' }).click()
  await dialog.getByRole('button', { name: 'Apagar', exact: true }).click()
  // Pede confirmação no próprio formulário, com o foco em "Não apagar".
  await expect(dialog.getByRole('button', { name: 'Não apagar' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Apagar', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Ler 30 livros este ano')).toBeHidden()
  await page.reload()
  await expect(page.getByText('Correr uma meia maratona')).toBeVisible()
  await expect(page.getByText('Ler 30 livros este ano')).toBeHidden()
})
