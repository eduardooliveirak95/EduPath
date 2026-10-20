import { describe, expect, it } from 'vitest'
import { buildNotifications } from '../hooks/useNotifications'
import type { Goal, GoalStatus } from '../types'
import { byStatus, matchesQuery, planSummary } from './goals'

let nextId = 1

function goal(fields: Partial<Goal> = {}): Goal {
  const status: GoalStatus = fields.status ?? 'em_curso'
  const closed = status === 'sucedido' || status === 'nao_sucedido'
  return {
    id: nextId++,
    title: 'Objetivo',
    description: null,
    category: 'pessoal',
    startDate: '2026-01-01',
    targetDate: '2026-07-01',
    progress: 0,
    status,
    plan: [],
    outcome: closed ? status : null,
    outcomeNote: null,
    closedAt: null,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
    ...fields,
  }
}

const step = (title: string, done = false) => ({ id: nextId++, title, done, position: 0 })

describe('matchesQuery', () => {
  const run = goal({
    title: 'Correr a meia maratona',
    description: 'Em menos de 2 horas',
    plan: [step('Treino de séries')],
  })

  it('procura no título, na descrição e nos passos', () => {
    expect(matchesQuery(run, 'maratona')).toBe(true)
    expect(matchesQuery(run, '2 horas')).toBe(true)
    expect(matchesQuery(run, 'treino')).toBe(true)
    expect(matchesQuery(run, 'natação')).toBe(false)
  })

  it('não liga a maiúsculas nem a acentos', () => {
    expect(matchesQuery(run, 'SERIES')).toBe(true)
    expect(matchesQuery(goal({ title: 'Saúde' }), 'saude')).toBe(true)
  })

  it('sem texto, mostra tudo', () => {
    expect(matchesQuery(run, '   ')).toBe(true)
  })
})

describe('planSummary', () => {
  it('conta os passos feitos', () => {
    expect(planSummary(goal({ plan: [step('a', true), step('b'), step('c', true)] }))).toEqual({ done: 2, total: 3 })
  })
})

describe('byStatus', () => {
  it('põe primeiro os por avaliar, depois os em curso por prazo, e no fim os avaliados (mais recentes primeiro)', () => {
    const goals = [
      goal({ title: 'não sucedido', status: 'nao_sucedido', closedAt: '2026-06-10' }),
      goal({ title: 'sucedido antes', status: 'sucedido', closedAt: '2026-05-01' }),
      goal({ title: 'em curso, prazo longe', targetDate: '2026-12-01' }),
      goal({ title: 'por avaliar', status: 'por_avaliar', targetDate: '2026-06-01' }),
      goal({ title: 'sucedido depois', status: 'sucedido', closedAt: '2026-06-01' }),
      goal({ title: 'em curso, prazo perto', targetDate: '2026-07-01' }),
    ]
    expect(goals.sort(byStatus).map((g) => g.title)).toEqual([
      'por avaliar',
      'em curso, prazo perto',
      'em curso, prazo longe',
      'sucedido depois',
      'sucedido antes',
      'não sucedido',
    ])
  })
})

describe('buildNotifications', () => {
  const today = '2026-06-15'

  it('avisa dos objetivos por avaliar e dos prazos até 7 dias', () => {
    const notifications = buildNotifications(
      [
        goal({ title: 'Prazo em 7 dias', targetDate: '2026-06-22' }),
        goal({ title: 'Prazo em 8 dias', targetDate: '2026-06-23' }),
        goal({ title: 'Terminou ontem', status: 'por_avaliar', targetDate: '2026-06-14' }),
        goal({ title: 'Já avaliado', status: 'sucedido', targetDate: '2026-06-14' }),
        goal({ title: 'Prazo hoje', targetDate: '2026-06-15' }),
      ],
      today,
    )
    expect(notifications.map((n) => [n.kind, n.title, n.text, n.page])).toEqual([
      ['avaliar', 'Terminou ontem', 'Terminou ontem. Regista o resultado.', 'painel'],
      ['prazo', 'Prazo hoje', 'Termina hoje. Vê os passos que faltam.', 'planos'],
      ['prazo', 'Prazo em 7 dias', 'Faltam 7 dias. Vê os passos que faltam.', 'planos'],
    ])
  })

  it('a notificação volta a ser nova se o prazo mudar (o id tem a data limite)', () => {
    const before = goal({ targetDate: '2026-06-20' })
    const after = { ...before, targetDate: '2026-06-21' }
    expect(buildNotifications([before], today)[0].id).not.toBe(buildNotifications([after], today)[0].id)
  })
})
