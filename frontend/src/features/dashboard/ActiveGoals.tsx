import { useState } from 'react'
import { ArrowRight, Plus, Target } from 'lucide-react'
import { GoalCard } from '../../components/goals/GoalCard'
import { Panel } from '../../components/ui/Panel'
import { CATEGORIES } from '../../data/categories'
import type { Category, Goal } from '../../types'

interface ActiveGoalsProps {
  goals: Goal[]
  today: string
  onNewGoal: () => void
  onEditGoal: (goalId: number) => void
  onShowProgress: (goalId: number) => void
  onCheckin: (goalId: number, day: string, done: boolean) => void
  onShowAll: () => void
}

export function ActiveGoals({
  goals,
  today,
  onNewGoal,
  onEditGoal,
  onShowProgress,
  onCheckin,
  onShowAll,
}: ActiveGoalsProps) {
  const [filter, setFilter] = useState<Category | 'todos'>('todos')

  const categories = [...new Set(goals.map((goal) => goal.category))]
  // Se a categoria escolhida deixar de ter objetivos em curso, volta a mostrar todos.
  const activeFilter = filter !== 'todos' && categories.includes(filter) ? filter : 'todos'
  const visible = activeFilter === 'todos' ? goals : goals.filter((goal) => goal.category === activeFilter)

  return (
    <Panel
      title="Objetivos em curso"
      icon={<Target size={18} aria-hidden />}
      count={goals.length}
      action={
        <button type="button" className="link-btn" onClick={onShowAll}>
          Ver todos <ArrowRight size={15} aria-hidden />
        </button>
      }
    >
      {goals.length === 0 ? (
        <div className="empty">
          <p>Não tens objetivos em curso.</p>
          <button type="button" className="link-btn" onClick={onNewGoal}>
            <Plus size={15} aria-hidden /> Novo objetivo
          </button>
        </div>
      ) : (
        <>
          <div className="chips" role="group" aria-label="Filtrar por categoria">
            <button
              type="button"
              className={activeFilter === 'todos' ? 'chip chip--active' : 'chip'}
              aria-pressed={activeFilter === 'todos'}
              onClick={() => setFilter('todos')}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={activeFilter === category ? 'chip chip--active' : 'chip'}
                aria-pressed={activeFilter === category}
                onClick={() => setFilter(category)}
              >
                {CATEGORIES[category].label}
              </button>
            ))}
          </div>

          <div className="goals-grid">
            {visible.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                today={today}
                onEdit={onEditGoal}
                onShowProgress={onShowProgress}
                onCheckin={onCheckin}
              />
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
