import { useState } from 'react'
import { ChevronLeft, ChevronRight, CircleCheck, CircleX, Repeat } from 'lucide-react'
import type { Goal, WeekResult } from '../../types'
import { formatWeekday, parseISODate } from '../../utils/date'
import {
  canCheckIn,
  checkinsIn,
  currentWeekIndex,
  isCheckedIn,
  weekLabel,
  weekOf,
  weekState,
  type WeekState,
} from '../../utils/habits'

const SHORT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const STATE_LABELS: Record<WeekState, string> = {
  cumprida: 'cumprida',
  nao_cumprida: 'não cumprida',
  em_curso: 'em curso',
  por_vir: 'por vir',
}

/** O resultado ao lado dos dias feitos, só nas semanas que já o têm. */
const RESULT_TEXT: Partial<Record<WeekState, string>> = { cumprida: 'Cumprida', nao_cumprida: 'Não cumprida' }

/** Com muitas semanas, as marcas da faixa ficam mais juntas para caberem no cartão. */
const CROWDED_WEEKS = 30

interface WeekTrackerProps {
  goal: Goal
  weeks: WeekResult[]
  today: string
  /** Sem ela, os dias só se veem (não se marcam). */
  onCheckin?: (goalId: number, day: string, done: boolean) => void
}

/**
 * Num objetivo recorrente: os dias de uma semana (de segunda a domingo), para marcar o que se fez,
 * e o resultado de cada semana. Começa na semana de hoje e as setas mostram as anteriores, para
 * marcar um dia que ficou esquecido.
 */
export function WeekTracker({ goal, weeks, today, onCheckin }: WeekTrackerProps) {
  // Quantas semanas para trás da de hoje: assim, ao voltar à app noutra semana, mostra a nova.
  const [weeksBack, setWeeksBack] = useState(0)
  const current = currentWeekIndex(weeks, today)
  const index = Math.max(0, current - weeksBack)
  const week = weeks[index]
  const times = goal.timesPerWeek ?? 1
  const count = checkinsIn(goal, week)
  const state = weekState(week, count, today)
  const states = weeks.map((each) => weekState(each, checkinsIn(goal, each), today))
  const tally = (wanted: WeekState) => states.filter((each) => each === wanted).length

  return (
    <div className="week-tracker">
      <div className="week-tracker__header">
        <span className="week-tracker__rule">
          <Repeat size={14} aria-hidden /> {times === 7 ? 'Todos os dias' : `${times}x por semana`}
        </span>
        <div className="week-tracker__nav">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setWeeksBack(current - index + 1)}
            disabled={index === 0}
            aria-label={`Semana anterior de "${goal.title}"`}
            title="Semana anterior"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setWeeksBack(current - index - 1)}
            disabled={index >= current}
            aria-label={`Semana seguinte de "${goal.title}"`}
            title="Semana seguinte"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="week-tracker__week" aria-live="polite">
        <span className="week-tracker__label">{weekLabel(week, today)}</span>
        <span className={`week-tracker__count is-${state}`}>
          {state === 'cumprida' && <CircleCheck size={14} aria-hidden />}
          {state === 'nao_cumprida' && <CircleX size={14} aria-hidden />}
          {count} de {week.needed}
          {RESULT_TEXT[state] && ` · ${RESULT_TEXT[state]}`}
        </span>
      </div>

      <div className="week-tracker__days" role="group" aria-label={`Dias da semana de "${goal.title}"`}>
        {weekOf(week.start).map((day) => {
          const checked = isCheckedIn(goal, week, day)
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

      {/* Todas as semanas do objetivo, numa faixa: cumpridas, não cumpridas e as que faltam. */}
      <div
        className={weeks.length > CROWDED_WEEKS ? 'week-strip week-strip--crowded' : 'week-strip'}
        style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Semanas: ${tally('cumprida')} cumpridas, ${tally('nao_cumprida')} não cumpridas, ${tally('em_curso') + tally('por_vir')} por acabar`}
      >
        {weeks.map((each, position) => (
          <span
            key={each.start}
            className={`week-strip__week is-${states[position]}${position === index ? ' is-selected' : ''}`}
            title={`${weekLabel(each, today)}: ${STATE_LABELS[states[position]]}`}
          />
        ))}
      </div>
    </div>
  )
}
