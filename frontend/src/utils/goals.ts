import { STATUS_ORDER } from '../data/statuses'
import type { Goal } from '../types'

export function planSummary(goal: Goal): { done: number; total: number } {
  return { done: goal.plan.filter((step) => step.done).length, total: goal.plan.length }
}

/** Em minúsculas e sem acentos: "Saúde" e "saude" são iguais na pesquisa. */
function simplify(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Se o objetivo tem o texto procurado no título, na descrição ou num passo do plano. */
export function matchesQuery(goal: Goal, query: string): boolean {
  const wanted = simplify(query.trim())
  if (!wanted) return true
  const texts = [goal.title, goal.description ?? '', ...goal.plan.map((step) => step.title)]
  return texts.some((text) => simplify(text).includes(wanted))
}

/** Data em que o objetivo terminou: a da avaliação ou, sem ela, a data limite. */
export function closedOn(goal: Goal): string {
  return goal.closedAt ?? goal.targetDate
}

export function byDeadline(a: Goal, b: Goal): number {
  return a.targetDate.localeCompare(b.targetDate) || a.id - b.id
}

/** Avaliados mais recentes primeiro. */
export function byClosedDesc(a: Goal, b: Goal): number {
  return closedOn(b).localeCompare(closedOn(a)) || b.id - a.id
}

/** Primeiro o que precisa de ação (por avaliar), depois em curso por prazo, e por fim os terminados. */
export function byStatus(a: Goal, b: Goal): number {
  const rank = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  if (rank !== 0) return rank
  const closed = a.status === 'sucedido' || a.status === 'nao_sucedido'
  return closed ? byClosedDesc(a, b) : byDeadline(a, b)
}
