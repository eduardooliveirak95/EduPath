import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { Plus, Trash2, X } from 'lucide-react'
import { ApiError } from '../../api/client'
import { CATEGORIES } from '../../data/categories'
import type { Category, Goal, GoalChanges, NewGoal } from '../../types'
import { addDays } from '../../utils/date'
import './goal-form.css'

const DEFAULT_DURATION_DAYS = 30

/** Passo no formulário. `id` só existe nos passos que já estão guardados. */
interface StepDraft {
  key: string
  id?: number
  title: string
  done: boolean
}

function initialSteps(goal: Goal | undefined): StepDraft[] {
  if (!goal?.plan.length) return [{ key: 'novo-0', title: '', done: false }]
  return goal.plan.map(({ id, title, done }) => ({ key: `passo-${id}`, id, title, done }))
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback
}

interface GoalDialogProps {
  today: string
  /** Objetivo a editar. Sem ele, o formulário cria um objetivo novo. */
  goal?: Goal
  onClose: () => void
  onCreate: (goal: NewGoal) => Promise<void>
  onUpdate: (goalId: number, changes: GoalChanges) => Promise<void>
  onDelete: (goalId: number) => Promise<void>
}

/** Formulário para criar ou editar um objetivo. Montado só quando está aberto, para começar sempre limpo. */
export function GoalDialog({ today, goal, onClose, onCreate, onUpdate, onDelete }: GoalDialogProps) {
  const isEditing = goal !== undefined
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const stepRefs = useRef<(HTMLInputElement | null)[]>([])
  const keepDeleteRef = useRef<HTMLButtonElement>(null)
  const nextStepKey = useRef(1)

  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [outcomeNote, setOutcomeNote] = useState(goal?.outcomeNote ?? '')
  const [category, setCategory] = useState<Category>(goal?.category ?? 'pessoal')
  const [startDate, setStartDate] = useState(goal?.startDate ?? today)
  const [targetDate, setTargetDate] = useState(() => goal?.targetDate ?? addDays(today, DEFAULT_DURATION_DAYS))
  const [progress, setProgress] = useState(goal?.progress ?? 0)
  const [steps, setSteps] = useState(() => initialSteps(goal))
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = saving || deleting

  useEffect(() => {
    dialogRef.current?.showModal()
    // O autoFocus do React corre antes de o diálogo abrir; sem isto o foco iria para o botão ✕.
    titleRef.current?.focus()
  }, [])

  const blankStep = (): StepDraft => ({ key: `novo-${nextStepKey.current++}`, title: '', done: false })

  const changeStep = (index: number, changes: Partial<StepDraft>) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...changes } : step)))

  const addStep = (afterIndex = steps.length - 1) => {
    flushSync(() => setSteps((current) => current.toSpliced(afterIndex + 1, 0, blankStep())))
    stepRefs.current[afterIndex + 1]?.focus()
  }

  const removeStep = (index: number) =>
    setSteps((current) => (current.length === 1 ? [blankStep()] : current.toSpliced(index, 1)))

  // Enter num passo cria o passo seguinte, em vez de submeter o formulário.
  const onStepKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addStep(index)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const fields = { title: title.trim(), category, startDate, targetDate, progress }
    // Passos sem texto são ignorados (ex.: a linha vazia que o formulário mostra sempre).
    const plan = steps.map((step) => ({ ...step, title: step.title.trim() })).filter((step) => step.title)
    try {
      if (isEditing) {
        // A nota só vai se mudou: se o objetivo foi avaliado noutro lado com o formulário
        // aberto, a caixa ainda vazia não apaga a nota que entretanto foi escrita.
        const note = outcomeNote.trim()
        const noteChanged = goal.outcome !== null && note !== (goal.outcomeNote ?? '')
        await onUpdate(goal.id, {
          ...fields,
          description: description.trim() || null,
          plan: plan.map(({ id, title, done }) => ({ id, title, done })),
          ...(noteChanged && { outcomeNote: note || null }),
        })
      } else {
        await onCreate({
          ...fields,
          description: description.trim() || undefined,
          plan: plan.map(({ title }) => ({ title })),
        })
      }
      onClose()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível guardar o objetivo.'))
      setSaving(false)
    }
  }

  const askToDelete = () => {
    setError(null)
    // O botão "Apagar" desaparece; o foco passa para a opção que não apaga nada.
    flushSync(() => setConfirmingDelete(true))
    keepDeleteRef.current?.focus()
  }

  const remove = async () => {
    if (!isEditing) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(goal.id)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível apagar o objetivo.'))
      setDeleting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="goal-dialog-title"
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
    >
      <form className="goal-form" onSubmit={submit}>
        <header className="modal__header">
          <h2 id="goal-dialog-title">{isEditing ? 'Editar objetivo' : 'Novo objetivo'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="modal__body">
          <label className="field">
            <span className="field__label">Objetivo</span>
            <input
              ref={titleRef}
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Correr uma meia maratona"
              maxLength={200}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">
              Descrição <span className="field__optional">(opcional)</span>
            </span>
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Como vais saber que o alcançaste?"
              maxLength={2000}
              rows={2}
            />
          </label>

          {goal?.outcome && (
            <label className="field">
              <span className="field__label">
                Nota do resultado{' '}
                <span className="field__optional">
                  ({goal.outcome === 'sucedido' ? 'sucedido' : 'não sucedido'}; opcional)
                </span>
              </span>
              <textarea
                className="input"
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder={
                  goal.outcome === 'sucedido' ? 'O que te ajudou a conseguir?' : 'O que faltou? O que farias diferente?'
                }
                maxLength={2000}
                rows={2}
              />
            </label>
          )}

          <fieldset className="field">
            <legend className="field__label">Categoria</legend>
            <div className="choices">
              {(Object.keys(CATEGORIES) as Category[]).map((key) => {
                const { label, icon: Icon } = CATEGORIES[key]
                return (
                  <label key={key} className="choice">
                    <input
                      type="radio"
                      name="category"
                      className="visually-hidden"
                      checked={category === key}
                      onChange={() => setCategory(key)}
                    />
                    <Icon size={15} aria-hidden />
                    {label}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Início</span>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Data limite</span>
              <input
                className="input"
                type="date"
                value={targetDate}
                min={startDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">
              Progresso atual <strong className="field__value">{progress}%</strong>
            </span>
            <input
              className="range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </label>

          <fieldset className="field">
            <legend className="field__label">
              Plano{' '}
              <span className="field__optional">
                {isEditing ? '(marca os passos que já fizeste)' : '(passos para lá chegar)'}
              </span>
            </legend>
            <ol className="plan-inputs">
              {steps.map((step, index) => (
                <li key={step.key} className={step.done ? 'plan-input plan-input--done' : 'plan-input'}>
                  {isEditing ? (
                    <input
                      type="checkbox"
                      className="plan-input__check"
                      checked={step.done}
                      onChange={(e) => changeStep(index, { done: e.target.checked })}
                      aria-label={`Passo ${index + 1} feito`}
                    />
                  ) : (
                    <span className="plan-input__number" aria-hidden>
                      {index + 1}
                    </span>
                  )}
                  <input
                    ref={(element) => {
                      stepRefs.current[index] = element
                    }}
                    className="input"
                    value={step.title}
                    onChange={(e) => changeStep(index, { title: e.target.value })}
                    onKeyDown={(e) => onStepKeyDown(e, index)}
                    placeholder={index === 0 ? 'Ex.: Correr 3 vezes por semana' : 'Passo seguinte'}
                    maxLength={200}
                    aria-label={`Passo ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="icon-btn plan-input__remove"
                    onClick={() => removeStep(index)}
                    aria-label={`Remover passo ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="link-btn" onClick={() => addStep()}>
              <Plus size={15} aria-hidden /> Adicionar passo
            </button>
          </fieldset>
        </div>

        <footer className="modal__footer">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {confirmingDelete ? (
            <>
              <p className="modal__confirm">Apagar este objetivo e o plano? Não dá para desfazer.</p>
              <button
                ref={keepDeleteRef}
                type="button"
                className="btn btn--ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
              >
                Não apagar
              </button>
              <button type="button" className="btn btn--danger-strong" onClick={remove} disabled={busy}>
                <Trash2 size={16} aria-hidden /> {deleting ? 'A apagar…' : 'Apagar'}
              </button>
            </>
          ) : (
            <>
              {isEditing && (
                <button type="button" className="btn btn--danger modal__delete" onClick={askToDelete} disabled={busy}>
                  <Trash2 size={16} aria-hidden /> Apagar
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {saving ? 'A guardar…' : isEditing ? 'Guardar' : 'Criar objetivo'}
              </button>
            </>
          )}
        </footer>
      </form>
    </dialog>
  )
}
