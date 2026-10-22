import { CircleCheck, Repeat } from 'lucide-react'
import type { Goal } from '../../types'
import { formatWeekday, parseISODate } from '../../utils/date'
import { canCheckIn, checkinsThisWeek, weekOf } from '../../utils/habits'

const SHORT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface WeekTrackerProps {
  goal: Goal
  today: string
  /** Sem ela, os dias só se veem (não se marcam). */
  onCheckin?: (goalId: number, day: string, done: boolean) => void
}

/** Num objetivo recorrente: os dias desta semana (de segunda a domingo), para marcar o que se fez. */
export function WeekTracker({ goal, today, onCheckin }: WeekTrackerProps) {
  const times = goal.timesPerWeek ?? 1
  const count = checkinsThisWeek(goal, today)
  const done = new Set(goal.checkins)

  return (
    <div className="week-tracker">
      <div className="week-tracker__header">
        <span className="week-tracker__rule">
          <Repeat size={14} aria-hidden /> {times === 7 ? 'Todos os dias' : `${times}x por semana`}
        </span>
        <span className={count >= times ? 'week-tracker__count is-met' : 'week-tracker__count'}>
          {count >= times && <CircleCheck size={14} aria-hidden />}
          Esta semana: {count} de {times}
        </span>
      </div>
      <div className="week-tracker__days" role="group" aria-label={`Dias desta semana de "${goal.title}"`}>
        {weekOf(today).map((day) => {
          const checked = done.has(day)
          const isToday = day === today
          return (
            <button
              key={day}
              type="button"
              className={isToday ? 'week-day week-day--today' : 'week-day'}
              aria-pressed={checked}
              aria-label={`${formatWeekday(day)}${isToday ? ', hoje' : ''}`}
              disabled={!onCheckin || !canCheckIn(goal, day, today)}
              onClick={() => onCheckin?.(goal.id, day, !checked)}
            >
              <span className="week-day__name">{SHORT_WEEKDAYS[parseISODate(day).getDay()]}</span>
              <span className="week-day__number">{parseISODate(day).getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
