import { RotateCcw } from 'lucide-react'
import type { Goal } from '../../types'

interface RepeatButtonProps {
  goal: Goal
  onRepeat: (goalId: number) => void
}

/** Cria um objetivo novo igual a um avaliado: "tentar outra vez" se falhou, "repetir" se correu bem. */
export function RepeatButton({ goal, onRepeat }: RepeatButtonProps) {
  const action = goal.status === 'nao_sucedido' ? 'Tentar outra vez' : 'Repetir'
  return (
    <button
      type="button"
      className="ghost-btn"
      onClick={() => onRepeat(goal.id)}
      aria-label={`${action} "${goal.title}"`}
      title={action}
    >
      <RotateCcw size={16} aria-hidden />
    </button>
  )
}
