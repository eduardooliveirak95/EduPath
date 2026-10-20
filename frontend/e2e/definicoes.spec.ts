import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { DEMO, openFromSidebar, resetData, signIn, today } from './support.ts'

test.beforeEach(async ({ page }) => {
  resetData()
  await signIn(page)
})

async function downloadFrom(page: Page, button: string) {
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: button }).click()
  const download = await downloading
  return { name: download.suggestedFilename(), content: await readFile(await download.path(), 'utf8') }
}

test('descarrega os objetivos em CSV e em JSON', async ({ page }) => {
  await openFromSidebar(page, 'Definições')

  const csv = await downloadFrom(page, 'Descarregar CSV')
  expect(csv.name).toBe(`edupath-${today()}.csv`)
  await expect(page.getByText(`Descarregado: ${csv.name}`)).toBeVisible()
  const lines = csv.content.split('\r\n')
  expect(lines[0]).toMatch(/^\uFEFFObjetivo;Descrição;Categoria;Estado;/)
  expect(lines.find((line) => line.startsWith('Deixar de fumar;'))).toContain(';Saúde;Não sucedido;')

  const json = await downloadFrom(page, 'Descarregar JSON')
  expect(json.name).toBe(`edupath-${today()}.json`)
  const data = JSON.parse(json.content)
  expect(data.account).toEqual({ name: DEMO.name, email: DEMO.email })
  expect(data.goals).toHaveLength(12)
  expect(data.goals.map((goal: { title: string }) => goal.title)).toContain('Correr uma meia maratona')
})
