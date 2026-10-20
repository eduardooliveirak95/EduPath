// Apoio aos testes de ponta a ponta: a API e o site de teste, e ações que vários testes usam.
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'

// Portas à parte, para os testes não usarem a API nem o site de desenvolvimento.
export const API_PORT = 8010
export const WEB_PORT = 4180
export const BACKEND_DIR = fileURLToPath(new URL('../../backend', import.meta.url))

/** Configuração da API nos testes: uma base de dados SQLite só para eles, fora do repositório. */
export const API_ENV = {
  DATABASE_URL: `sqlite:///${join(tmpdir(), 'edupath-e2e.db')}`,
  SESSION_SECRET: 'segredo-dos-testes-de-ponta-a-ponta-0123456789',
  INVITE_CODE: 'convite-e2e',
  TIMEZONE: 'Europe/Lisbon',
}

export const DEMO = { name: 'Demo', email: 'demo@edupath.pt', password: 'edupath-demo' }

/** Apaga tudo e volta a pôr a conta demo (a do administrador) com os objetivos de exemplo. */
export function resetData() {
  execFileSync('uv', ['run', 'python', '-m', 'app.seed', '--reset'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, ...API_ENV },
    stdio: 'ignore',
  })
}

export async function signIn(page: Page, email = DEMO.email, password = DEMO.password) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  // Com objetivos, a saudação ("Bom dia, Demo"); sem nenhum, as boas-vindas.
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bom dia|Boa tarde|Boa noite|Bem-vindo/)
}

/** Carrega num botão da barra lateral (no telemóvel, abre primeiro o menu). */
export async function openFromSidebar(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('complementary', { name: 'Navegação principal' }).getByRole('button', { name, exact: true }).click()
}

/** O token da sessão com que o browser entrou, para preparar dados pela API. */
export async function sessionToken(page: Page): Promise<string> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('edupath.session') ?? '{}').token)
}
