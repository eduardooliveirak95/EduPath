import { useState, type CSSProperties } from 'react'
import { Check, Circle, Footprints } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { CATEGORIES } from '../../data/categories'
import type { Goal } from '../../types'

interface NextStepsProps {
  goals: Goal[]
  onCompleteStep: (goalId: number, stepId: number) => Promise<void>
}

/** Primeiro passo por fazer no plano de cada objetivo, pela ordem dos prazos. */
export function NextSteps({ goals, onCompleteStep }: NextStepsProps) {
  const [pendingStep, setPendingStep] = useState<number | null>(null)

  const items = [...goals]
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    .flatMap((goal) => {
      const step = goal.plan.find((s) => !s.done)
      return step ? [{ goal, step }] : []
    })

  const complete = async (goalId: number, stepId: number) => {
    setPendingStep(stepId)
    await onCompleteStep(goalId, stepId)
    setPendingStep(null)
  }

  return (
    <Panel
      title="Próximos passos"
      icon={<Footprints size={18} aria-hidden />}
      subtitle="O passo seguinte do plano de cada objetivo"
    >
      {items.length === 0 ? (
        <p className="empty">Não há passos por fazer nos planos em curso.</p>
      ) : (
        <ul className="steps">
          {items.map(({ goal, step }) => (
            <li key={step.id} className="step" style={{ '--step-color': CATEGORIES[goal.category].color } as CSSProperties}>
              <button
                type="button"
                className="step__check"
                onClick={() => complete(goal.id, step.id)}
                disabled={pendingStep === step.id}
                aria-label={`Marcar "${step.title}" como feito`}
                title="Marcar como feito"
              >
                <Circle className="step__icon step__icon--idle" size={20} aria-hidden />
                <Check className="step__icon step__icon--hover" size={14} strokeWidth={3} aria-hidden />
              </button>
              <div className="step__body">
                <p className="step__title">{step.title}</p>
                <p className="step__goal">{goal.title}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
