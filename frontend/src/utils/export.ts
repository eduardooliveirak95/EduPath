import { CATEGORIES } from '../data/categories'
import { STATUSES } from '../data/statuses'
import type { Goal, ProgressPoint, User } from '../types'

/** Nome do ficheiro descarregado, com o dia (ex.: edupath-2026-10-20.csv). */
export function exportFileName(today: string, extension: 'json' | 'csv'): string {
  return `edupath-${today}.${extension}`
}

/** Um objetivo com a evolução do progresso (no ficheiro JSON). */
export type GoalWithHistory = Goal & { progressHistory: ProgressPoint[] }

/** Tudo o que a API dá dos objetivos da conta, com a evolução do progresso, para guardar (JSON). */
export function goalsToJson(user: User, goals: GoalWithHistory[], exportedAt: string): string {
  const data = { app: 'EduPath', exportedAt, account: { name: user.name, email: user.email }, goals }
  return JSON.stringify(data, null, 2)
}

// Os textos que começam assim seriam lidos como fórmulas pelo Excel (ex.: "-10 kg" dava erro).
const FORMULA_START = /^[=+\-@\t\r]/

function csvCell(value: string | number): string {
  let text = String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const CSV_COLUMNS: [string, (goal: Goal) => string | number][] = [
  ['Objetivo', (goal) => goal.title],
  ['Descrição', (goal) => goal.description ?? ''],
  ['Categoria', (goal) => CATEGORIES[goal.category].label],
  ['Estado', (goal) => STATUSES[goal.status].label],
  ['Início', (goal) => goal.startDate],
  ['Data limite', (goal) => goal.targetDate],
  ['Progresso (%)', (goal) => goal.progress],
  ['Progresso pelos passos', (goal) => (goal.progressFromSteps ? 'Sim' : 'Não')],
  ['Vezes por semana', (goal) => goal.timesPerWeek ?? ''],
  ['Semanas cumpridas', (goal) => (goal.weeks ? `${goal.weeks.met} de ${goal.weeks.total}` : '')],
  ['Passos feitos', (goal) => `${goal.plan.filter((step) => step.done).length} de ${goal.plan.length}`],
  ['Plano', (goal) => goal.plan.map((step) => `${step.done ? '[x]' : '[ ]'} ${step.title}`).join('\n')],
  ['Terminou em', (goal) => goal.closedAt ?? ''],
  ['Nota do resultado', (goal) => goal.outcomeNote ?? ''],
]

/**
 * Um objetivo por linha, para abrir numa folha de cálculo. Separado por ";" (o que o Excel
 * espera em português) e com BOM, para o Excel ler os acentos em UTF-8.
 */
export function goalsToCsv(goals: Goal[]): string {
  const rows = [
    CSV_COLUMNS.map(([header]) => header),
    ...goals.map((goal) => CSV_COLUMNS.map(([, value]) => value(goal))),
  ]
  return `﻿${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`
}
