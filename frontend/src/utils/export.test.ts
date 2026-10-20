import { describe, expect, it } from 'vitest'
import type { Goal, User } from '../types'
import { exportFileName, goalsToCsv, goalsToJson } from './export'

const user: User = { id: 1, name: 'Eduardo', email: 'eu@exemplo.pt', isAdmin: true }

const goal: Goal = {
  id: 7,
  title: 'Correr "a sério"; sem parar',
  description: '-10 kg até ao verão',
  category: 'saude',
  startDate: '2026-01-01',
  targetDate: '2026-06-30',
  progress: 50,
  progressFromSteps: true,
  status: 'sucedido',
  plan: [
    { id: 1, title: 'Comprar sapatilhas', done: true, position: 0 },
    { id: 2, title: 'Correr 5 km', done: false, position: 1 },
  ],
  outcome: 'sucedido',
  outcomeNote: null,
  closedAt: '2026-06-28',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-06-28T10:00:00Z',
}

describe('goalsToCsv', () => {
  const csv = goalsToCsv([goal])
  const [header, row] = csv.slice(1).split('\r\n')

  it('começa com BOM e tem uma linha de cabeçalho e uma por objetivo', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(header).toBe(
      'Objetivo;Descrição;Categoria;Estado;Início;Data limite;Progresso (%);Progresso pelos passos;' +
        'Passos feitos;Plano;Avaliado em;Nota do resultado',
    )
  })

  it('põe aspas onde é preciso e não deixa o texto passar por fórmula', () => {
    expect(row).toBe(
      [
        '"Correr ""a sério""; sem parar"',
        "'-10 kg até ao verão",
        'Saúde',
        'Sucedido',
        '2026-01-01',
        '2026-06-30',
        '50',
        'Sim',
        '1 de 2',
        '"[x] Comprar sapatilhas\n[ ] Correr 5 km"',
        '2026-06-28',
        '',
      ].join(';'),
    )
  })

  it('sem objetivos, só o cabeçalho', () => {
    expect(goalsToCsv([]).slice(1).split('\r\n')).toEqual([header, ''])
  })
})

describe('goalsToJson', () => {
  it('guarda a conta, a data e os objetivos tal como vêm da API', () => {
    expect(JSON.parse(goalsToJson(user, [goal], '2026-10-20T18:00:00.000Z'))).toEqual({
      app: 'EduPath',
      exportedAt: '2026-10-20T18:00:00.000Z',
      account: { name: 'Eduardo', email: 'eu@exemplo.pt' },
      goals: [goal],
    })
  })
})

describe('exportFileName', () => {
  it('tem o dia e a extensão', () => {
    expect(exportFileName('2026-10-20', 'csv')).toBe('edupath-2026-10-20.csv')
  })
})
