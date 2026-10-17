import { ArrowRight, History } from 'lucide-react'
import { HistoryItem } from '../../components/goals/HistoryItem'
import { Panel } from '../../components/ui/Panel'
import type { Goal } from '../../types'
import { byClosedDesc } from '../../utils/goals'

const MAX_ITEMS = 4

interface RecentHistoryProps {
  goals: Goal[]
  onReopen: (goalId: number) => Promise<void>
  onEdit: (goalId: number) => void
  onShowAll: () => void
}

/** Últimos objetivos avaliados, com o resultado registado. */
export function RecentHistory({ goals, onReopen, onEdit, onShowAll }: RecentHistoryProps) {
  const recent = [...goals].sort(byClosedDesc).slice(0, MAX_ITEMS)

  return (
    <Panel
      title="Histórico"
      icon={<History size={18} aria-hidden />}
      action={
        <button type="button" className="link-btn" onClick={onShowAll}>
          Ver tudo <ArrowRight size={15} aria-hidden />
        </button>
      }
    >
      {recent.length === 0 ? (
        <p className="empty">Ainda não avaliaste nenhum objetivo.</p>
      ) : (
        <ul className="history">
          {recent.map((goal) => (
            <HistoryItem key={goal.id} goal={goal} onEdit={onEdit} onReopen={onReopen} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
