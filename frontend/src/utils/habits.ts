import type { Goal } from '../types'
import { addDays, parseISODate } from './date'

/** Os sete dias (de segunda a domingo) da semana de um dia, em AAAA-MM-DD. */
export function weekOf(day: string): string[] {
  const sinceMonday = (parseISODate(day).getDay() + 6) % 7
  const monday = addDays(day, -sinceMonday)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

/** Quantos dias da semana de `today` estão registados. */
export function checkinsThisWeek(goal: Pick<Goal, 'checkins'>, today: string): number {
  const week = weekOf(today)
  return goal.checkins.filter((day) => week.includes(day)).length
}

/**
 * Se o dia se pode marcar: entre o início e hoje, até à data limite, e o objetivo ainda por
 * avaliar. A API verifica o mesmo (`get_checkin_goal` em routers/goals.py); isto só desativa os botões.
 */
export function canCheckIn(goal: Pick<Goal, 'startDate' | 'targetDate' | 'outcome'>, day: string, today: string) {
  return goal.outcome === null && day >= goal.startDate && day <= today && day <= goal.targetDate
}

/** A lista de dias com o dia acrescentado (por ordem) ou tirado. */
export function toggleDay(days: string[], day: string, done: boolean): string[] {
  const others = days.filter((other) => other !== day)
  return done ? [...others, day].sort() : others
}
