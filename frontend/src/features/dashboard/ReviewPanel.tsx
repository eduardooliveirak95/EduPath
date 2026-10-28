import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CircleCheck, CircleX, Hourglass, Pencil } from 'lucide-react'
import { CategoryBadge } from '../../components/ui/CategoryBadge'
import { Panel } from '../../components/ui/Panel'
import type { Goal, GoalOutcome } from '../../types'
import { daysBetween, describeDaysLeft } from '../../utils/date'

type EvaluateGoal = (goalId: number, outcome: GoalOutcome, note?: string) => Promise<void>

interface ReviewItemProps {
  goal: Goal
  today: string
  onEvaluate: EvaluateGoal
  onEdit: (goalId: number) => void
}

/** Um objetivo por avaliar: escolher o resultado abre uma nota opcional antes de guardar. */
function ReviewItem({ goal, today, onEvaluate, onEdit }: ReviewItemProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const [outcome, setOutcome] = useState<GoalOutcome | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const success = outcome === 'sucedido'

  useEffect(() => {
    if (outcome) noteRef.current?.focus()
  }, [outcome])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!outcome) return
    setSaving(true)
    // Se correr bem, o objetivo passa para o histórico e este item desaparece.
    // Se falhar, o erro aparece no aviso global e a nota fica para tentar outra vez.
    await onEvaluate(goal.id, outcome, note.trim() || undefined)
    setSaving(false)
  }

  return (
    <li className="review-item">
      <div className="review-item__head">
        <div className="review-item__info">
          <p className="review-item__title">{goal.title}</p>
          <div className="review-item__meta">
            <CategoryBadge category={goal.category} />
            <span>{describeDaysLeft(daysBetween(today, goal.targetDate))}</span>
            <span>· {goal.progress}%</span>
            {goal.weeks && (
              <span>
                · {goal.weeks.met}/{goal.weeks.total} semanas cumpridas
              </span>
            )}
          </div>
        </div>
        {/* Editar também serve para prolongar o prazo, em vez de avaliar já. */}
        <button
          type="button"
          className="ghost-btn"
          onClick={() => onEdit(goal.id)}
          aria-label={`Editar "${goal.title}"`}
          title="Editar ou prolongar o prazo"
        >
          <Pencil size={16} />
        </button>
      </div>

      {outcome === null ? (
        <div className="review-item__actions">
          <button type="button" className="btn btn--sm btn--success" onClick={() => setOutcome('sucedido')}>
            <CircleCheck size={16} aria-hidden /> Sucedido
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={() => setOutcome('nao_sucedido')}>
            <CircleX size={16} aria-hidden /> Não sucedido
          </button>
        </div>
      ) : (
        <form className="review-item__form" onSubmit={save}>
          <p className={success ? 'review-item__choice is-success' : 'review-item__choice is-failure'}>
            {success ? <CircleCheck size={16} aria-hidden /> : <CircleX size={16} aria-hidden />}
            {success ? 'Sucedido' : 'Não sucedido'}
          </p>
          <label className="field">
            <span className="field__label">Nota (opcional)</span>
            <textarea
              ref={noteRef}
              className="input review-item__note"
              rows={2}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={success ? 'O que te ajudou a conseguir?' : 'O que faltou? O que farias diferente?'}
            />
          </label>
          <div className="review-item__actions">
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOutcome(null)} disabled={saving}>
              Voltar
            </button>
            <button type="submit" className={success ? 'btn btn--sm btn--success' : 'btn btn--sm btn--danger'} disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar resultado'}
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

interface ReviewPanelProps {
  goals: Goal[]
  today: string
  onEvaluate: EvaluateGoal
  onEdit: (goalId: number) => void
}

/** Objetivos cujo prazo já terminou e que esperam pelo registo do resultado. */
export function ReviewPanel({ goals, today, onEvaluate, onEdit }: ReviewPanelProps) {
  return (
    <Panel
      className="review-panel"
      title="Por avaliar"
      icon={<Hourglass size={18} aria-hidden />}
      count={goals.length}
      subtitle="O prazo terminou. Conseguiste alcançar o objetivo?"
    >
      {goals.length === 0 ? (
        <p className="empty">Não tens objetivos à espera de avaliação.</p>
      ) : (
        <ul className="review-list">
          {goals.map((goal) => (
            <ReviewItem key={goal.id} goal={goal} today={today} onEvaluate={onEvaluate} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
