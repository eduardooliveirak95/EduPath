import { useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { GoalCard } from '../../components/goals/GoalCard'
import { CATEGORIES } from '../../data/categories'
import { STATUSES, STATUS_ORDER } from '../../data/statuses'
import type { Category, Goal, GoalStatus } from '../../types'
import { byDeadline, byStatus, matchesQuery } from '../../utils/goals'
import '../dashboard/dashboard.css' // .chips, .goals-grid, .empty
import '../../components/layout/page.css'

type Sort = 'estado' | 'prazo' | 'progresso' | 'recentes'

const SORTS: Record<Sort, { label: string; compare: (a: Goal, b: Goal) => number }> = {
  estado: { label: 'Por estado', compare: byStatus },
  prazo: { label: 'Por prazo', compare: byDeadline },
  progresso: { label: 'Por progresso', compare: (a, b) => b.progress - a.progress || byDeadline(a, b) },
  recentes: { label: 'Mais recentes', compare: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id },
}

interface GoalsPageProps {
  goals: Goal[]
  today: string
  /** Texto da pesquisa da barra de topo. */
  query: string
  onClearQuery: () => void
  onNewGoal: () => void
  onEditGoal: (goalId: number) => void
  onRepeatGoal: (goalId: number) => void
  onShowProgress: (goalId: number) => void
}

/** Todos os objetivos, com filtros por estado e categoria, pesquisa e ordenação. */
export function GoalsPage({
  goals,
  today,
  query,
  onClearQuery,
  onNewGoal,
  onEditGoal,
  onRepeatGoal,
  onShowProgress,
}: GoalsPageProps) {
  const [status, setStatus] = useState<GoalStatus | 'todos'>('todos')
  const [category, setCategory] = useState<Category | 'todas'>('todas')
  const [sort, setSort] = useState<Sort>('estado')

  const searched = goals.filter((goal) => matchesQuery(goal, query))
  const inCategory = category === 'todas' ? searched : searched.filter((goal) => goal.category === category)
  const countOf = (value: GoalStatus) => inCategory.filter((goal) => goal.status === value).length
  const visible = (status === 'todos' ? inCategory : inCategory.filter((goal) => goal.status === status)).sort(
    SORTS[sort].compare,
  )
  const filtered = status !== 'todos' || category !== 'todas' || query.trim() !== ''

  const clearFilters = () => {
    setStatus('todos')
    setCategory('todas')
    onClearQuery()
  }

  const chip = (value: GoalStatus | 'todos', label: string, count: number) => (
    <button
      key={value}
      type="button"
      className={status === value ? 'chip chip--active' : 'chip'}
      aria-pressed={status === value}
      onClick={() => setStatus(value)}
    >
      {label}
      <span className="chip__count">{count}</span>
    </button>
  )

  return (
    <div className="page">
      <header className="page__intro">
        <h1>Objetivos</h1>
        <p>Todos os teus objetivos: os que estão em curso e os que já terminaram.</p>
      </header>

      {goals.length === 0 ? (
        <div className="empty">
          <Target size={22} aria-hidden />
          <p>Ainda não tens objetivos.</p>
          <button type="button" className="link-btn" onClick={onNewGoal}>
            <Plus size={15} aria-hidden /> Criar o primeiro objetivo
          </button>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div className="chips" role="group" aria-label="Filtrar por estado">
              {chip('todos', 'Todos', inCategory.length)}
              {STATUS_ORDER.map((value) => chip(value, STATUSES[value].plural, countOf(value)))}
            </div>
            <div className="toolbar__selects">
              <select
                className="select"
                aria-label="Categoria"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category | 'todas')}
              >
                <option value="todas">Todas as categorias</option>
                {Object.entries(CATEGORIES).map(([value, info]) => (
                  <option key={value} value={value}>
                    {info.label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                aria-label="Ordenar"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                {Object.entries(SORTS).map(([value, info]) => (
                  <option key={value} value={value}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {query.trim() && (
            <p className="page__notice" role="status">
              <span>
                {searched.length === 1 ? '1 resultado' : `${searched.length} resultados`} para{' '}
                <strong>“{query.trim()}”</strong>
              </span>
              <button type="button" className="link-btn" onClick={onClearQuery}>
                Limpar pesquisa
              </button>
            </p>
          )}

          {visible.length === 0 ? (
            <div className="empty">
              <p>Nenhum objetivo corresponde a estes filtros.</p>
              {filtered && (
                <button type="button" className="link-btn" onClick={clearFilters}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="goals-grid">
              {visible.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  today={today}
                  onEdit={onEditGoal}
                  onRepeat={onRepeatGoal}
                  onShowProgress={onShowProgress}
                  showStatus
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
