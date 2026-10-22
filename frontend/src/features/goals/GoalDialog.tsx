import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react'
import { ApiError } from '../../api/client'
import { CATEGORIES } from '../../data/categories'
import type { Category, Goal, GoalChanges, NewGoal } from '../../types'
import { addDays } from '../../utils/date'
import { stepsProgress } from '../../utils/goals'
import './goal-form.css'

const DEFAULT_DURATION_DAYS = 30
/** Intervalo da barra do progresso escolhido à mão. */
const PROGRESS_STEP = 5
/** Objetivos recorrentes: de 1 a 7 vezes por semana; 3 ao ligar a opção. */
const TIMES_PER_WEEK = [1, 2, 3, 4, 5, 6, 7]
const DEFAULT_TIMES_PER_WEEK = 3

/** Passo no formulário. `id` só existe nos passos que já estão guardados. */
interface StepDraft {
  key: string
  id?: number
  title: string
  done: boolean
}

function initialSteps(goal: Goal | undefined, draft: NewGoal | undefined): StepDraft[] {
  if (goal?.plan.length) return goal.plan.map(({ id, title, done }) => ({ key: `passo-${id}`, id, title, done }))
  if (draft?.plan.length) return draft.plan.map(({ title }, index) => ({ key: `copia-${index}`, title, done: false }))
  return [{ key: 'novo-0', title: '', done: false }]
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback
}

interface GoalDialogProps {
  today: string
  /** Objetivo a editar. Sem ele, o formulário cria um objetivo novo. */
  goal?: Goal
  /** Objetivo novo já preenchido (ex.: para repetir um que já foi avaliado), e o título do formulário. */
  draft?: { goal: NewGoal; heading: string }
  onClose: () => void
  onCreate: (goal: NewGoal) => Promise<void>
  onUpdate: (goalId: number, changes: GoalChanges) => Promise<void>
  onDelete: (goalId: number) => Promise<void>
}

/** Formulário para criar ou editar um objetivo. Montado só quando está aberto, para começar sempre limpo. */
export function GoalDialog({ today, goal, draft, onClose, onCreate, onUpdate, onDelete }: GoalDialogProps) {
  const isEditing = goal !== undefined
  const initial = isEditing ? undefined : draft?.goal
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const stepRefs = useRef<(HTMLInputElement | null)[]>([])
  const moveRefs = useRef(new Map<string, HTMLButtonElement | null>())
  const keepDeleteRef = useRef<HTMLButtonElement>(null)
  const nextStepKey = useRef(1)

  const [title, setTitle] = useState(goal?.title ?? initial?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? initial?.description ?? '')
  const [outcomeNote, setOutcomeNote] = useState(goal?.outcomeNote ?? '')
  const [category, setCategory] = useState<Category>(goal?.category ?? initial?.category ?? 'pessoal')
  const [startDate, setStartDate] = useState(goal?.startDate ?? initial?.startDate ?? today)
  const [targetDate, setTargetDate] = useState(
    () => goal?.targetDate ?? initial?.targetDate ?? addDays(today, DEFAULT_DURATION_DAYS),
  )
  const [progress, setProgress] = useState(goal?.progress ?? initial?.progress ?? 0)
  // Nos objetivos novos, o progresso vem dos passos, a não ser que se escolha o contrário.
  const [progressFromSteps, setProgressFromSteps] = useState(
    goal?.progressFromSteps ?? initial?.progressFromSteps ?? true,
  )
  const [timesPerWeek, setTimesPerWeek] = useState(goal?.timesPerWeek ?? initial?.timesPerWeek ?? null)
  const [steps, setSteps] = useState(() => initialSteps(goal, initial))
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

  const moveStep = (index: number, offset: -1 | 1) => {
    const target = index + offset
    const { key } = steps[index]
    flushSync(() => setSteps((current) => current.with(index, current[target]).with(target, current[index])))
    // O passo mudou de lugar e o browser pode tirar-lhe o foco. Fica no mesmo botão,
    // ou no outro se este deixou de servir (o passo chegou ao início ou ao fim).
    const atEdge = target === 0 || target === steps.length - 1
    const direction = atEdge ? -offset : offset
    moveRefs.current.get(`${key}:${direction}`)?.focus()
  }

  // Enter num passo cria o passo seguinte, em vez de submeter o formulário.
  const onStepKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addStep(index)
  }

  // Passos sem texto são ignorados (ex.: a linha vazia que o formulário mostra sempre).
  const filledSteps = steps.filter((step) => step.title.trim())
  const doneCount = filledSteps.filter((step) => step.done).length
  const stepsHint =
    filledSteps.length === 0
      ? 'Ainda não há passos no plano.'
      : `${doneCount} de ${filledSteps.length} ${filledSteps.length === 1 ? 'passo feito' : 'passos feitos'}.`
  const shownProgress = progressFromSteps ? stepsProgress(filledSteps) : progress

  const changeProgressFromSteps = (checked: boolean) => {
    // Ao passar a escolher à mão, a barra começa na percentagem que se estava a ver.
    if (!checked) setProgress(Math.round(shownProgress / PROGRESS_STEP) * PROGRESS_STEP)
    setProgressFromSteps(checked)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const fields = { title: title.trim(), category, startDate, targetDate, progressFromSteps, timesPerWeek }
    // A percentagem escolhida à mão só conta sem a dos passos e sem ser recorrente.
    const manualProgress = !progressFromSteps && timesPerWeek === null
    const plan = filledSteps.map((step) => ({ ...step, title: step.title.trim() }))
    try {
      if (isEditing) {
        // A nota só vai se mudou: se o objetivo foi avaliado noutro lado com o formulário
        // aberto, a caixa ainda vazia não apaga a nota que entretanto foi escrita.
        const note = outcomeNote.trim()
        const noteChanged = goal.outcome !== null && note !== (goal.outcomeNote ?? '')
        await onUpdate(goal.id, {
          ...fields,
          // Nos outros casos, a percentagem escolhida à mão fica como estava.
          ...(manualProgress && { progress }),
          description: description.trim() || null,
          plan: plan.map(({ id, title, done }) => ({ id, title, done })),
          ...(noteChanged && { outcomeNote: note || null }),
        })
      } else {
        await onCreate({
          ...fields,
          progress: manualProgress ? progress : 0,
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
          <h2 id="goal-dialog-title">{isEditing ? 'Editar objetivo' : (draft?.heading ?? 'Novo objetivo')}</h2>
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

          <div className="field">
            <label className="check-field">
              <input
                type="checkbox"
                checked={timesPerWeek !== null}
                onChange={(e) => setTimesPerWeek(e.target.checked ? DEFAULT_TIMES_PER_WEEK : null)}
              />
              Repetir todas as semanas
            </label>
            {timesPerWeek !== null && (
              <select
                className="input"
                aria-label="Vezes por semana"
                value={timesPerWeek}
                onChange={(e) => setTimesPerWeek(Number(e.target.value))}
              >
                {TIMES_PER_WEEK.map((times) => (
                  <option key={times} value={times}>
                    {times === 7 ? 'Todos os dias' : times === 1 ? '1 vez por semana' : `${times} vezes por semana`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field">
            {timesPerWeek !== null ? (
              <>
                <span className="field__label">
                  Progresso
                  {goal?.weeks && <strong className="field__value">{goal.progress}%</strong>}
                </span>
                <span className="field__hint">
                  É a percentagem dos dias feitos, das vezes pedidas por semana (de segunda a domingo) até à data
                  limite. Cada dia conta logo e marca-se no cartão do objetivo.
                </span>
              </>
            ) : progressFromSteps ? (
              <>
                <span className="field__label">
                  Progresso <strong className="field__value">{shownProgress}%</strong>
                </span>
                <span className="field__hint">{stepsHint}</span>
              </>
            ) : (
              <label className="field">
                <span className="field__label">
                  Progresso atual <strong className="field__value">{progress}%</strong>
                </span>
                <input
                  className="range"
                  type="range"
                  min={0}
                  max={100}
                  step={PROGRESS_STEP}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                />
              </label>
            )}
            {timesPerWeek === null && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={progressFromSteps}
                  onChange={(e) => changeProgressFromSteps(e.target.checked)}
                />
                Calcular pelos passos feitos
              </label>
            )}
          </div>

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
                  {steps.length > 1 && (
                    <div className="plan-input__move">
                      <button
                        ref={(element) => {
                          moveRefs.current.set(`${step.key}:-1`, element)
                        }}
                        type="button"
                        className="ghost-btn"
                        onClick={() => moveStep(index, -1)}
                        disabled={index === 0}
                        aria-label={`Subir passo ${index + 1}`}
                        title="Subir"
                      >
                        <ChevronUp size={16} aria-hidden />
                      </button>
                      <button
                        ref={(element) => {
                          moveRefs.current.set(`${step.key}:1`, element)
                        }}
                        type="button"
                        className="ghost-btn"
                        onClick={() => moveStep(index, 1)}
                        disabled={index === steps.length - 1}
                        aria-label={`Descer passo ${index + 1}`}
                        title="Descer"
                      >
                        <ChevronDown size={16} aria-hidden />
                      </button>
                    </div>
                  )}
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
