import { expect, test } from '@playwright/test'
import { resetData, sessionToken, signIn } from './support.ts'

test.beforeEach(resetData)

test('instala-se como app: manifesto e service worker', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ name: 'EduPath', display: 'standalone', start_url: '/' })

  await signIn(page)
  const worker = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)
  expect(worker).toBe('activated')
})

test('ao voltar à app depois de algum tempo, mostra o que mudou noutro sítio', async ({ page, request }) => {
  await page.clock.install()
  // Esconder e mostrar a app, como no telemóvel ao mudar de app.
  await page.addInitScript(() => {
    const state = { visibility: 'visible' }
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state.visibility })
    Object.assign(window, { setVisibility: (value: string) => {
      state.visibility = value
      document.dispatchEvent(new Event('visibilitychange'))
    } })
  })
  const setVisibility = (value: string) =>
    page.evaluate((v) => (window as unknown as { setVisibility: (v: string) => void }).setVisibility(v), value)

  await signIn(page)
  // Outro dispositivo cria um objetivo.
  await request.post('/api/goals', {
    headers: { Authorization: `Bearer ${await sessionToken(page)}` },
    data: { title: 'Criado no computador', category: 'pessoal', targetDate: '2030-01-01' },
  })
  await expect(page.getByText('Criado no computador')).toBeHidden()

  await setVisibility('hidden')
  await page.clock.fastForward('02:00') // 2 minutos noutra app
  await setVisibility('visible')
  await expect(page.getByText('Criado no computador')).toBeVisible()
})
