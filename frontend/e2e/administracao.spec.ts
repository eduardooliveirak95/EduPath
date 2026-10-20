import { expect, test } from '@playwright/test'
import { openFromSidebar, resetData, sessionToken, signIn } from './support.ts'

test.beforeEach(async ({ page }) => {
  resetData()
  await signIn(page)
})

test('convida uma pessoa, que cria conta pelo link e não vê a Administração', async ({ page, browser }) => {
  await openFromSidebar(page, 'Administração')
  await page.getByRole('button', { name: 'Criar convite' }).click()
  await page.getByRole('button', { name: 'Copiar link' }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/\/\?convite=[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)

  // A pessoa convidada abre o link noutro browser: o código já vem preenchido.
  const guest = await (await browser.newContext()).newPage()
  await guest.goto(link)
  await expect(guest.getByRole('heading', { name: 'Criar conta' })).toBeVisible()
  await guest.getByLabel('Nome').fill('Ana Silva')
  await guest.getByLabel('Email').fill('ana@exemplo.pt')
  await guest.getByLabel('Password', { exact: true }).fill('password-da-ana')
  await guest.getByLabel('Repetir password').fill('password-da-ana')
  await guest.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(guest.getByRole('heading', { name: 'Bem-vindo ao EduPath' })).toBeVisible()

  // Só o administrador vê a Administração.
  const menu = guest.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible()) await menu.click()
  await expect(guest.getByRole('button', { name: 'Definições' })).toBeVisible()
  await expect(guest.getByRole('button', { name: 'Administração' })).toBeHidden()

  // O convite fica usado, com o nome de quem o usou.
  await page.reload()
  await expect(page.getByText('Ana Silva criou conta')).toBeVisible()
})

test('dá uma password nova a uma conta', async ({ page, browser, request }) => {
  // A Ana já tem conta (criada pela API, com um convite do administrador).
  const token = await sessionToken(page)
  const invite = await (await request.post('/api/invites', { headers: { Authorization: `Bearer ${token}` } })).json()
  await request.post('/api/auth/register', {
    data: { name: 'Ana Silva', email: 'ana@exemplo.pt', password: 'password-esquecida', inviteCode: invite.code },
  })

  await openFromSidebar(page, 'Administração')
  await page.getByRole('button', { name: 'Dar uma password nova a Ana Silva' }).click()
  await page.getByRole('button', { name: 'Criar password' }).click()
  const password = await page.locator('.account-row__password').innerText()
  expect(password).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)

  const ana = await (await browser.newContext()).newPage()
  await signIn(ana, 'ana@exemplo.pt', password)
  await expect(ana.getByRole('heading', { name: 'Bem-vindo ao EduPath' })).toBeVisible()
})
