import { useState } from 'react'
import { CircleCheck, CircleX, Pencil, Undo2 } from 'lucide-react'
import type { Goal } from '../../types'
import { formatLongDate } from '../../utils/date'
import { closedOn, planSummary } from '../../utils/goals'
import { CategoryBadge } from '../ui/CategoryBadge'
import { RepeatButton } from './RepeatButton'
import './goals.css'

interface HistoryItemProps {
  goal: Goal
  onEdit: (goalId: number) => void
  onReopen: (goalId: number) => Promise<void>
  /** Mostra o botão para criar outro objetivo igual. */
  onRepeat?: (goalId: number) => void
  /** Mostra também a categoria, o progresso e os passos feitos (página Histórico). */
  detailed?: boolean
}

/** Um objetivo avaliado, com o resultado, e as ações para o editar ou anular a avaliação. */
export function HistoryItem({ goal, onEdit, onReopen, onRepeat, detailed = false }: HistoryItemProps) {
  const [reopening, setReopening] = useState(false)
  const success = goal.status === 'sucedido'
  const { done, total } = planSummary(goal)

  const reopen = async () => {
    setReopening(true)
    await onReopen(goal.id)
    setReopening(false)
  }

  return (
    <li className="history-item">
      <span className={success ? 'history-item__icon is-success' : 'history-item__icon is-failure'}>
        {success ? <CircleCheck size={18} aria-hidden /> : <CircleX size={18} aria-hidden />}
      </span>
      <div className="history-item__body">
        <p className="history-item__title">{goal.title}</p>
        <p className="history-item__meta">
          <span className={success ? 'outcome is-success' : 'outcome is-failure'}>
            {success ? 'Sucedido' : 'Não sucedido'}
          </span>
          {' · '}
          {formatLongDate(closedOn(goal))}
        </p>
        {detailed && (
          <div className="history-item__details">
            <CategoryBadge category={goal.category} />
            <span>{goal.progress}% de progresso</span>
            {total > 0 && (
              <span>
                {done}/{total} passos
              </span>
            )}
          </div>
        )}
        {goal.outcomeNote && <p className="history-item__note">{goal.outcomeNote}</p>}
      </div>
      <div className="history-item__actions">
        {onRepeat && <RepeatButton goal={goal} onRepeat={onRepeat} />}
        <button
          type="button"
          className="ghost-btn"
          onClick={() => onEdit(goal.id)}
          aria-label={`Editar "${goal.title}"`}
          title="Editar"
        >
          <Pencil size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={reopen}
          disabled={reopening}
          aria-label={`Anular a avaliação de "${goal.title}"`}
          title="Anular avaliação"
        >
          <Undo2 size={16} aria-hidden />
        </button>
      </div>
    </li>
  )
}
