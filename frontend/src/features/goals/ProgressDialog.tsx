import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { CATEGORIES } from '../../data/categories'
import type { Goal, ProgressPoint } from '../../types'
import { formatLongDate } from '../../utils/date'
import { describeProgress } from '../../utils/progress'
import { ProgressChart } from './ProgressChart'
import './goal-form.css' // .modal
import './progress.css'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; points: ProgressPoint[] }

interface ProgressDialogProps {
  goal: Goal
  today: string
  onClose: () => void
}

/** A evolução do progresso de um objetivo: o gráfico e, por baixo, os valores em tabela. */
export function ProgressDialog({ goal, today, onClose }: ProgressDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // Volta a pedir se a percentagem mudar com a janela aberta (ex.: ao voltar à app).
  useEffect(() => {
    let cancelled = false
    api.goalProgress(goal.id).then(
      (points) => {
        if (!cancelled) setState({ kind: 'ready', points })
      },
      (error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: errorMessage(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [goal.id, goal.progress])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="progress-dialog-title"
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
    >
      <div className="goal-form">
        <header className="modal__header">
          <div>
            <h2 id="progress-dialog-title">Evolução do progresso</h2>
            <p className="progress-dialog__goal">{goal.title}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* A cor da categoria, para a linha do gráfico e a chave da legenda. */}
        <div className="modal__body" style={{ '--chart-color': CATEGORIES[goal.category].color } as CSSProperties}>
          {state.kind === 'loading' && (
            <p className="progress-dialog__status" aria-live="polite">
              <LoaderCircle className="spin" size={18} aria-hidden /> A carregar…
            </p>
          )}
          {state.kind === 'error' && (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          )}
          {state.kind === 'ready' && (
            <>
              <p className="progress-dialog__summary">{describeProgress(state.points)}</p>
              <ul className="progress-legend" aria-label="Legenda">
                <li>
                  <span className="progress-legend__key" aria-hidden /> Progresso
                </li>
                <li>
                  <span className="progress-legend__key progress-legend__key--pace" aria-hidden /> Ritmo constante até à
                  data limite
                </li>
              </ul>
              <ProgressChart points={state.points} goal={goal} today={today} />
              <details className="progress-table">
                <summary>Ver os registos ({state.points.length})</summary>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Dia</th>
                      <th scope="col">Progresso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.points.map((point) => (
                      <tr key={point.day}>
                        <td>{formatLongDate(point.day)}</td>
                        <td>{point.progress}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
