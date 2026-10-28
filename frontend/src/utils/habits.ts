import type { Goal, WeekResult } from '../types'
import { addDays, parseISODate } from './date'

/** Os sete dias (de segunda a domingo) da semana de um dia, em AAAA-MM-DD. */
export function weekOf(day: string): string[] {
  const sinceMonday = (parseISODate(day).getDay() + 6) % 7
  const monday = addDays(day, -sinceMonday)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

/**
 * Quantos dias da semana estão marcados. Conta-os aqui (e não usa o `done` da API) para o
 * resultado da semana mudar logo ao marcar um dia.
 */
export function checkinsIn(goal: Pick<Goal, 'checkins'>, week: Pick<WeekResult, 'start' | 'end'>): number {
  return goal.checkins.filter((day) => day >= week.start && day <= week.end).length
}

/** Uma semana é cumprida com os dias que pede; senão, não cumprida se já acabou, em curso ou por vir. */
export type WeekState = 'cumprida' | 'nao_cumprida' | 'em_curso' | 'por_vir'

export function weekState(week: WeekResult, done: number, today: string): WeekState {
  if (done >= week.needed) return 'cumprida'
  if (week.end < today) return 'nao_cumprida'
  return week.start <= today ? 'em_curso' : 'por_vir'
}

/** A semana de hoje ou, se o objetivo ainda não começou ou já acabou, a primeira ou a última. */
export function currentWeekIndex(weeks: Pick<WeekResult, 'end'>[], today: string): number {
  const index = weeks.findIndex((week) => today <= week.end)
  return index === -1 ? weeks.length - 1 : index
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
