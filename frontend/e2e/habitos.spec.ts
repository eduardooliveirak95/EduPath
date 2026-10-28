import { expect, test } from '@playwright/test'
import { openFromSidebar, resetData, signIn, today } from './support.ts'

test.beforeEach(async ({ page }) => {
  resetData()
  await signIn(page)
})

test('cria um objetivo recorrente e marca o dia de hoje', async ({ page }) => {
  await page.locator('.topbar').getByRole('button', { name: 'Novo objetivo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo objetivo' })
  await dialog.getByLabel('Objetivo').fill('Ler 20 páginas')
  await dialog.getByLabel('Repetir todas as semanas').check()
  await dialog.getByLabel('Vezes por semana').selectOption({ label: '3 vezes por semana' })
  // A percentagem passa a ser a dos dias feitos: sem barra nem "Calcular pelos passos feitos".
  await expect(dialog.getByText(/É a percentagem dos dias feitos/)).toBeVisible()
  await expect(dialog.getByLabel('Calcular pelos passos feitos')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Criar objetivo' }).click()
  await expect(dialog).toBeHidden()

  const card = page.locator('.goal-card').filter({ hasText: 'Ler 20 páginas' })
  const progress = card.getByRole('progressbar')
  const count = card.locator('.week-tracker__count')
  // Começou hoje: esta semana pede 3 dias, ou menos se já não lhe restarem tantos.
  const daysLeft = 7 - ((new Date(`${today()}T12:00:00Z`).getUTCDay() + 6) % 7)
  const needed = Math.min(3, daysLeft)
  await expect(card.locator('.week-tracker__label')).toHaveText('Esta semana')
  await expect(count).toHaveText(`0 de ${needed}`)
  // É a primeira semana: não há anteriores.
  await expect(card.getByRole('button', { name: 'Semana anterior de "Ler 20 páginas"' })).toBeDisabled()
  // Começou hoje: só hoje se pode marcar (os dias antes do início e os que aí vêm, não).
  await expect(card.locator('.week-day:enabled')).toHaveCount(1)
  const todayButton = card.getByRole('button', { name: /, hoje$/ })
  await todayButton.click()
  await expect(todayButton).toHaveAttribute('aria-pressed', 'true')
  await expect(count).toContainText(`1 de ${needed}`)
  // Cada dia feito conta logo, mesmo sem a semana estar cumprida.
  await expect(progress).not.toHaveAttribute('aria-valuenow', '0')

  await page.reload()
  await expect(todayButton).toHaveAttribute('aria-pressed', 'true')
  await todayButton.click()
  await expect(count).toHaveText(`0 de ${needed}`)
  await expect(progress).toHaveAttribute('aria-valuenow', '0')

  // Deixa de ser recorrente: a semana sai do cartão.
  await card.getByRole('button', { name: 'Editar "Ler 20 páginas"' }).click()
  const editing = page.getByRole('dialog', { name: 'Editar objetivo' })
  await expect(editing.getByLabel('Vezes por semana')).toHaveValue('3')
  await editing.getByLabel('Repetir todas as semanas').uncheck()
  await editing.getByRole('button', { name: 'Guardar' }).click()
  await expect(editing).toBeHidden()
  await expect(card.getByText(/Esta semana/)).toHaveCount(0)
})

test('marca um dia esquecido na semana passada e vê o resultado de cada semana', async ({ page }) => {
  await openFromSidebar(page, 'Objetivos')
  const title = 'Ir ao ginásio 3 vezes por semana'
  const card = page.locator('.goal-card').filter({ hasText: title })
  const label = card.locator('.week-tracker__label')
  const count = card.locator('.week-tracker__count')
  const days = card.getByRole('group', { name: `Dias da semana de "${title}"` })
  const previous = card.getByRole('button', { name: `Semana anterior de "${title}"` })
  const next = card.getByRole('button', { name: `Semana seguinte de "${title}"` })
  // Cada dia marcado ou desmarcado fica guardado antes de passar ao seguinte.
  const toggle = async (day: ReturnType<typeof days.getByRole>) => {
    const saved = page.waitForResponse((response) => response.url().includes('/checkins/'))
    await day.click()
    expect((await saved).ok()).toBe(true)
  }

  await expect(label).toHaveText('Esta semana')
  await expect(next).toBeDisabled()
  await previous.click()
  await expect(label).toHaveText('Semana passada')

  // Sem nenhum dia, a semana que já acabou fica não cumprida.
  const pressed = days.locator('[aria-pressed="true"]')
  while ((await pressed.count()) > 0) await toggle(pressed.first())
  await expect(count).toHaveText('0 de 3 · Não cumprida')
  await expect(card.locator('.week-strip__week.is-selected')).toHaveClass(/is-nao_cumprida/)

  // Os dias esquecidos marcam-se depois: com 3, fica cumprida.
  for (const name of [/^segunda-feira/, /^terça-feira/, /^quarta-feira/]) {
    await toggle(days.getByRole('button', { name }))
  }
  await expect(count).toHaveText('3 de 3 · Cumprida')
  await expect(card.locator('.week-strip__week.is-selected')).toHaveClass(/is-cumprida/)

  await page.reload()
  await previous.click()
  await expect(count).toHaveText('3 de 3 · Cumprida')
  await next.click()
  await expect(label).toHaveText('Esta semana')
  await expect(card.getByRole('img', { name: /^Semanas: \d+ cumpridas, \d+ não cumpridas/ })).toBeVisible()
})

/** Uma promessa e a função que a cumpre, para combinar a ordem das respostas da API. */
function signal() {
  let done: () => void = () => {}
  const promise = new Promise<void>((resolve) => (done = resolve))
  return { promise, done }
}

test('dias marcados seguidos ficam todos, mesmo com as respostas por outra ordem', async ({ page }) => {
  await openFromSidebar(page, 'Objetivos')
  const title = 'Ir ao ginásio 3 vezes por semana'
  const card = page.locator('.goal-card').filter({ hasText: title })
  const days = card.getByRole('group', { name: `Dias da semana de "${title}"` })
  const previous = card.getByRole('button', { name: `Semana anterior de "${title}"` })
  const progress = card.getByRole('progressbar')
  await previous.click()
  const pressed = days.locator('[aria-pressed="true"]')
  while ((await pressed.count()) > 0) {
    const saved = page.waitForResponse((response) => response.url().includes('/checkins/'))
    await pressed.first().click()
    await saved
  }

  // A resposta da segunda só chega depois da da terça (e não traz a terça). Depois, o objetivo
  // pedido outra vez só chega depois de marcada a quarta (e não traz a quarta).
  const mondaySent = signal()
  const tuesdayDelivered = signal()
  const refetchSent = signal()
  const wednesdayDelivered = signal()
  const refetchDelivered = signal()
  let checkins = 0
  await page.route('**/api/goals/*/checkins/*', async (route) => {
    const order = ++checkins
    const response = await route.fetch()
    if (order === 1) {
      mondaySent.done()
      await tuesdayDelivered.promise
    }
    await route.fulfill({ response })
    if (order === 2) tuesdayDelivered.done()
    if (order === 3) wednesdayDelivered.done()
  })
  await page.route(/\/api\/goals\/\d+$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const response = await route.fetch()
    refetchSent.done()
    await wednesdayDelivered.promise
    await route.fulfill({ response })
    refetchDelivered.done()
  })

  await days.getByRole('button', { name: /^segunda-feira/ }).click()
  await mondaySent.promise
  await days.getByRole('button', { name: /^terça-feira/ }).click()
  await refetchSent.promise
  await days.getByRole('button', { name: /^quarta-feira/ }).click()
  await refetchDelivered.promise
  // Dá tempo ao site para tratar a última resposta, a do objetivo pedido outra vez.
  await page.waitForTimeout(500)
  await expect(card.locator('.week-tracker__count')).toHaveText('3 de 3 · Cumprida')
  await expect(pressed).toHaveCount(3)
  const shown = await progress.getAttribute('aria-valuenow')

  // O que ficou no ecrã é o que a API guardou, incluindo a percentagem.
  await page.unrouteAll()
  await page.reload()
  await previous.click()
  await expect(pressed).toHaveCount(3)
  await expect(progress).toHaveAttribute('aria-valuenow', shown ?? '')
})
