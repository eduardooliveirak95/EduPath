import { STATUS_ORDER } from '../data/statuses'
import type { Goal, NewGoal, PlanStep } from '../types'
import { addDays, daysBetween } from './date'

export function planSummary(goal: Goal): { done: number; total: number } {
  return { done: goal.plan.filter((step) => step.done).length, total: goal.plan.length }
}

/**
 * Passos feitos em percentagem, arredondada (sem passos, 0).
 * Tem de dar o mesmo que `steps_progress` (backend/app/models.py), que o calcula na API.
 */
export function stepsProgress(plan: { done: boolean }[]): number {
  if (plan.length === 0) return 0
  return Math.round((plan.filter((step) => step.done).length * 100) / plan.length)
}

/** O objetivo com o plano mudado. Se o progresso vem dos passos, volta a ser calculado, como na API. */
export function withPlan(goal: Goal, plan: PlanStep[]): Goal {
  return { ...goal, plan, progress: goal.progressFromSteps ? stepsProgress(plan) : goal.progress }
}

/** Um objetivo novo igual a outro (para o repetir), a começar hoje e com a mesma duração. */
export function repeatGoal(goal: Goal, today: string): NewGoal {
  return {
    title: goal.title,
    description: goal.description ?? undefined,
    category: goal.category,
    startDate: today,
    targetDate: addDays(today, daysBetween(goal.startDate, goal.targetDate)),
    progress: 0,
    progressFromSteps: goal.progressFromSteps,
    timesPerWeek: goal.timesPerWeek,
    plan: goal.plan.map(({ title }) => ({ title })),
  }
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

/** Os que terminaram mais recentemente primeiro. */
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
