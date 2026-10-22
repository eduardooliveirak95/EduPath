import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { DEMO, openFromSidebar, resetData, sessionToken, signIn, today } from './support.ts'

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
  expect(data.goals).toHaveLength(13)
  const run = data.goals.find((goal: { title: string }) => goal.title === 'Correr uma meia maratona')
  // Cada objetivo leva a evolução do progresso; o último registo é a percentagem de agora.
  expect(run.progressHistory.map((point: { progress: number }) => point.progress)).toEqual([0, 15, 30, 45])
})

test('uma conta convidada apaga-se a si própria; a do administrador não', async ({ page, browser, request }) => {
  // O administrador não tem a opção.
  await openFromSidebar(page, 'Definições')
  await expect(page.getByRole('heading', { name: 'Os teus dados' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Apagar a conta' })).toHaveCount(0)

  // A Ana tem conta (com um convite do administrador) e um objetivo.
  const invite = await (
    await request.post('/api/invites', { headers: { Authorization: `Bearer ${await sessionToken(page)}` } })
  ).json()
  const session = await (
    await request.post('/api/auth/register', {
      data: { name: 'Ana Silva', email: 'ana@exemplo.pt', password: 'password-da-ana', inviteCode: invite.code },
    })
  ).json()
  await request.post('/api/goals', {
    headers: { Authorization: `Bearer ${session.token}` },
    data: { title: 'Aprender guitarra', category: 'pessoal', targetDate: '2099-12-31' },
  })

  const ana = await (await browser.newContext()).newPage()
  await signIn(ana, 'ana@exemplo.pt', 'password-da-ana')
  await openFromSidebar(ana, 'Definições')
  await ana.getByRole('button', { name: 'Apagar a minha conta' }).click()
  const password = ana.getByLabel('Password, para confirmar')
  await expect(password).toBeFocused()

  // Com a password errada, não apaga nada e a sessão continua.
  await password.fill('errada')
  await ana.getByRole('button', { name: 'Apagar para sempre' }).click()
  await expect(ana.getByRole('alert')).toHaveText('A password está errada.')
  await expect(ana.getByRole('heading', { name: 'Definições' })).toBeVisible()

  await password.fill('password-da-ana')
  await ana.getByRole('button', { name: 'Apagar para sempre' }).click()
  await expect(ana.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expect(ana.getByText('A tua conta foi apagada, com os objetivos e os planos.')).toBeVisible()

  // Já não entra, e o administrador deixa de a ver.
  await ana.getByLabel('Email').fill('ana@exemplo.pt')
  await ana.getByLabel('Password').fill('password-da-ana')
  await ana.getByRole('button', { name: 'Entrar' }).click()
  await expect(ana.getByText('Email ou password errados.')).toBeVisible()
  await openFromSidebar(page, 'Administração')
  const accounts = page.getByRole('main') // a barra lateral também tem o email da conta
  await expect(accounts.getByText(DEMO.email)).toBeVisible()
  await expect(accounts.getByText('ana@exemplo.pt')).toHaveCount(0)
})
