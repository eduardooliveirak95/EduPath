import { CalendarCheck, ChartLine, Clock, ListChecks, Pencil, Repeat } from 'lucide-react'
import { CATEGORIES } from '../../data/categories'
import type { Goal } from '../../types'
import { daysBetween, describeDaysLeft, formatShortDate } from '../../utils/date'
import { closedOn, planSummary } from '../../utils/goals'
import { RepeatButton } from './RepeatButton'
import { WeekTracker } from './WeekTracker'
import { CategoryBadge } from '../ui/CategoryBadge'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'
import './goals.css'

/** Prazos a menos de N dias aparecem destacados. */
const URGENT_DAYS = 14

interface GoalCardProps {
  goal: Goal
  today: string
  onEdit: (goalId: number) => void
  /** Nos objetivos avaliados, mostra o botão para criar outro igual. */
  onRepeat?: (goalId: number) => void
  /** Mostra o botão da evolução do progresso. */
  onShowProgress?: (goalId: number) => void
  /** Num objetivo recorrente em curso, deixa marcar os dias desta semana. */
  onCheckin?: (goalId: number, day: string, done: boolean) => void
  /** Mostra o estado ao lado da categoria (onde há objetivos com estados diferentes). */
  showStatus?: boolean
}

export function GoalCard({
  goal,
  today,
  onEdit,
  onRepeat,
  onShowProgress,
  onCheckin,
  showStatus = false,
}: GoalCardProps) {
  const daysLeft = daysBetween(today, goal.targetDate)
  const { done, total } = planSummary(goal)
  const closed = goal.status === 'sucedido' || goal.status === 'nao_sucedido'

  return (
    <article className="goal-card">
      <header className="goal-card__header">
        <div className="goal-card__badges">
          <CategoryBadge category={goal.category} />
          {showStatus && <StatusBadge status={goal.status} />}
        </div>
        <div className="goal-card__actions">
          {onShowProgress && (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onShowProgress(goal.id)}
              aria-label={`Evolução de "${goal.title}"`}
              title="Evolução do progresso"
            >
              <ChartLine size={16} aria-hidden />
            </button>
          )}
          {closed && onRepeat && <RepeatButton goal={goal} onRepeat={onRepeat} />}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onEdit(goal.id)}
            aria-label={`Editar "${goal.title}"`}
            title="Editar"
          >
            <Pencil size={16} />
          </button>
        </div>
      </header>

      <h3 className="goal-card__title">{goal.title}</h3>
      {goal.description && <p className="goal-card__description">{goal.description}</p>}

      <div className="goal-card__progress">
        <div className="goal-card__progress-label">
          <span>Progresso</span>
          <strong>{goal.progress}%</strong>
        </div>
        <ProgressBar
          value={goal.progress}
          color={CATEGORIES[goal.category].color}
          label={`Progresso de ${goal.title}`}
        />
      </div>

      {goal.weeks && goal.status === 'em_curso' && <WeekTracker goal={goal} today={today} onCheckin={onCheckin} />}

      <footer className="goal-card__footer">
        {goal.weeks ? (
          <span className="goal-card__meta" title="Semanas cumpridas (de segunda a domingo)">
            <Repeat size={15} aria-hidden />
            {goal.weeks.met}/{goal.weeks.total} semanas
          </span>
        ) : (
          <span className="goal-card__meta">
            <ListChecks size={15} aria-hidden />
            {done}/{total} passos
          </span>
        )}
        {closed ? (
          <span className="goal-card__meta">
            <CalendarCheck size={15} aria-hidden />
            Avaliado a {formatShortDate(closedOn(goal))}
          </span>
        ) : (
          <span
            className={daysLeft <= URGENT_DAYS ? 'goal-card__meta goal-card__meta--urgent' : 'goal-card__meta'}
            title={`Data limite: ${formatShortDate(goal.targetDate)}`}
          >
            <Clock size={15} aria-hidden />
            {describeDaysLeft(daysLeft)}
          </span>
        )}
      </footer>
    </article>
  )
}
