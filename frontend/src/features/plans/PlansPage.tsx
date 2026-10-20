import { useRef, useState, type FormEvent } from 'react'
import { CalendarCheck, Clock, ListChecks, Pencil, Plus } from 'lucide-react'
import { errorMessage } from '../../api/client'
import { CategoryBadge } from '../../components/ui/CategoryBadge'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { CATEGORIES } from '../../data/categories'
import type { GoalActions } from '../../hooks/useGoals'
import type { Goal, PlanStep } from '../../types'
import { daysBetween, describeDaysLeft, formatShortDate } from '../../utils/date'
import { byClosedDesc, byDeadline, closedOn, planSummary } from '../../utils/goals'
import '../dashboard/dashboard.css' // .chips, .empty
import '../../components/layout/page.css'
import './plans.css'

type Tab = 'ativos' | 'terminados'

function isClosed(goal: Goal): boolean {
  return goal.status === 'sucedido' || goal.status === 'nao_sucedido'
}

function AddStepForm({ goal, onAdd }: { goal: Goal; onAdd: GoalActions['addStep'] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onAdd(goal.id, title.trim())
      setTitle('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
      inputRef.current?.focus()
    }
  }

  return (
    <form className="add-step" onSubmit={submit}>
      <div className="add-step__row">
        <input
          ref={inputRef}
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Acrescentar um passo…"
          aria-label={`Novo passo para "${goal.title}"`}
          maxLength={200}
        />
        <button type="submit" className="btn btn--ghost" disabled={saving || !title.trim()} aria-label="Acrescentar">
          <Plus size={16} aria-hidden />
          <span className="add-step__label">Acrescentar</span>
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

interface PlanCardProps {
  goal: Goal
  today: string
  actions: GoalActions
  onEdit: (goalId: number) => void
}

function PlanCard({ goal, today, actions, onEdit }: PlanCardProps) {
  const [pendingStep, setPendingStep] = useState<number | null>(null)
  const { done, total } = planSummary(goal)
  const closed = isClosed(goal)

  const toggle = async (step: PlanStep) => {
    setPendingStep(step.id)
    await actions.setStepDone(goal.id, step.id, !step.done)
    setPendingStep(null)
  }

  return (
    <article className="plan-card">
      <header className="plan-card__header">
        <div className="plan-card__heading">
          <h2 className="plan-card__title">{goal.title}</h2>
          <div className="plan-card__meta">
            <CategoryBadge category={goal.category} />
            {goal.status !== 'em_curso' && <StatusBadge status={goal.status} />}
            {closed ? (
              <span>
                <CalendarCheck size={14} aria-hidden /> Avaliado a {formatShortDate(closedOn(goal))}
              </span>
            ) : (
              <span title={`Data limite: ${formatShortDate(goal.targetDate)}`}>
                <Clock size={14} aria-hidden /> {describeDaysLeft(daysBetween(today, goal.targetDate))}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => onEdit(goal.id)}
          aria-label={`Editar "${goal.title}"`}
          title="Editar o objetivo e o plano"
        >
          <Pencil size={16} aria-hidden />
        </button>
      </header>

      {total > 0 ? (
        <>
          <div className="plan-card__summary">
            <div className="plan-card__summary-label">
              <span>
                {done} de {total} {total === 1 ? 'passo feito' : 'passos feitos'}
              </span>
              <span>{goal.progress}% do objetivo</span>
            </div>
            <ProgressBar
              value={(done / total) * 100}
              color={CATEGORIES[goal.category].color}
              label={`Passos feitos de ${goal.title}`}
            />
          </div>

          <ul className="plan-steps">
            {goal.plan.map((step) => (
              <li key={step.id} className={step.done ? 'plan-step is-done' : 'plan-step'}>
                <label>
                  <input
                    type="checkbox"
                    checked={step.done}
                    disabled={pendingStep === step.id}
                    onChange={() => toggle(step)}
                  />
                  <span>{step.title}</span>
                </label>
              </li>
            ))}
          </ul>
          {done === total && !closed && <p className="plan-card__complete">Plano concluído 🎉</p>}
        </>
      ) : (
        <p className="plan-card__empty">Este objetivo ainda não tem passos.</p>
      )}

      {!closed && <AddStepForm goal={goal} onAdd={actions.addStep} />}
    </article>
  )
}

interface PlansPageProps {
  goals: Goal[]
  today: string
  actions: GoalActions
  onNewGoal: () => void
  onEditGoal: (goalId: number) => void
}

/** O plano (passos) de cada objetivo: marcar o que já está feito e acrescentar passos. */
export function PlansPage({ goals, today, actions, onNewGoal, onEditGoal }: PlansPageProps) {
  const [tab, setTab] = useState<Tab>('ativos')

  const active = goals.filter((goal) => !isClosed(goal)).sort(byDeadline)
  const closed = goals.filter(isClosed).sort(byClosedDesc)
  const visible = tab === 'ativos' ? active : closed
  const remaining = active.reduce((sum, goal) => sum + goal.plan.filter((step) => !step.done).length, 0)

  const chip = (value: Tab, label: string, count: number) => (
    <button
      type="button"
      className={tab === value ? 'chip chip--active' : 'chip'}
      aria-pressed={tab === value}
      onClick={() => setTab(value)}
    >
      {label}
      <span className="chip__count">{count}</span>
    </button>
  )

  return (
    <div className="page">
      <header className="page__intro">
        <h1>Planos</h1>
        <p>
          Os passos de cada objetivo. Marca o que já fizeste e acrescenta passos novos.
          {active.length > 0 && (
            <>
              {' '}
              {remaining === 0 ? (
                <strong>Não tens passos por fazer.</strong>
              ) : (
                <strong>
                  {remaining === 1 ? 'Falta 1 passo' : `Faltam ${remaining} passos`} nos objetivos ativos.
                </strong>
              )}
            </>
          )}
        </p>
      </header>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Que planos mostrar">
          {chip('ativos', 'Ativos', active.length)}
          {chip('terminados', 'Terminados', closed.length)}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <ListChecks size={22} aria-hidden />
          {tab === 'ativos' ? (
            <>
              <p>Não tens objetivos ativos.</p>
              <button type="button" className="link-btn" onClick={onNewGoal}>
                <Plus size={15} aria-hidden /> Novo objetivo
              </button>
            </>
          ) : (
            <p>Ainda não avaliaste nenhum objetivo.</p>
          )}
        </div>
      ) : (
        <div className="plans-grid">
          {visible.map((goal) => (
            <PlanCard key={goal.id} goal={goal} today={today} actions={actions} onEdit={onEditGoal} />
          ))}
        </div>
      )}
    </div>
  )
}
