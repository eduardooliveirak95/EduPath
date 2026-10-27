import { useState, type CSSProperties } from 'react'
import { ChartBar, CircleCheck, CircleX, History, Trophy, type LucideIcon } from 'lucide-react'
import { HistoryItem } from '../../components/goals/HistoryItem'
import { CategoryBadge } from '../../components/ui/CategoryBadge'
import { Panel } from '../../components/ui/Panel'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CATEGORIES } from '../../data/categories'
import type { GoalActions } from '../../hooks/useGoals'
import type { Category, Goal, GoalOutcome } from '../../types'
import { parseISODate } from '../../utils/date'
import { byClosedDesc, closedOn } from '../../utils/goals'
import '../dashboard/dashboard.css' // .stats, .chips, .empty
import '../../components/layout/page.css'
import './history.css'

const monthFormat = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })

function rate(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

/** Objetivos agrupados pelo mês em que foram avaliados ("Outubro de 2026"), do mais recente. */
function groupByMonth(goals: Goal[]): { label: string; goals: Goal[] }[] {
  const groups = new Map<string, Goal[]>()
  for (const goal of goals) {
    const month = closedOn(goal).slice(0, 7)
    groups.set(month, [...(groups.get(month) ?? []), goal])
  }
  return [...groups.entries()].map(([month, items]) => {
    const label = monthFormat.format(parseISODate(`${month}-01`))
    return { label: label.charAt(0).toUpperCase() + label.slice(1), goals: items }
  })
}

interface Stat {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  color: string
}

function Summary({ closed }: { closed: Goal[] }) {
  const succeeded = closed.filter((goal) => goal.status === 'sucedido').length
  const failed = closed.length - succeeded
  const stats: Stat[] = [
    { label: 'Avaliados', value: String(closed.length), hint: 'objetivos com resultado', icon: History, color: 'var(--primary)' },
    { label: 'Sucedidos', value: String(succeeded), hint: 'objetivos alcançados', icon: CircleCheck, color: 'var(--success)' },
    { label: 'Não sucedidos', value: String(failed), hint: 'ficaram por alcançar', icon: CircleX, color: 'var(--danger)' },
    {
      label: 'Taxa de sucesso',
      value: `${rate(succeeded, closed.length)}%`,
      hint: `${succeeded} de ${closed.length} objetivos`,
      icon: Trophy,
      color: 'var(--success)',
    },
  ]

  return (
    <section className="stats" aria-label="Resumo do histórico">
      {stats.map(({ label, value, hint, icon: Icon, color }) => (
        <article key={label} className="stat" style={{ '--stat-color': color } as CSSProperties}>
          <span className="stat__icon" aria-hidden>
            <Icon size={20} />
          </span>
          <div>
            <p className="stat__label">{label}</p>
            <p className="stat__value">{value}</p>
            <p className="stat__hint">{hint}</p>
          </div>
        </article>
      ))}
    </section>
  )
}

/** Taxa de sucesso de cada categoria com objetivos avaliados, pela ordem fixa das categorias. */
function SuccessByCategory({ closed }: { closed: Goal[] }) {
  const rows = (Object.keys(CATEGORIES) as Category[]).flatMap((category) => {
    const inCategory = closed.filter((goal) => goal.category === category)
    if (inCategory.length === 0) return []
    const succeeded = inCategory.filter((goal) => goal.status === 'sucedido').length
    return [{ category, succeeded, total: inCategory.length }]
  })

  return (
    <Panel title="Sucesso por categoria" icon={<ChartBar size={18} aria-hidden />}>
      <ul className="category-rates">
        {rows.map(({ category, succeeded, total }) => (
          <li key={category} className="category-rate" title={`${succeeded} de ${total} sucedidos`}>
            <div className="category-rate__label">
              <CategoryBadge category={category} />
              <span className="category-rate__count">
                {succeeded} de {total}
              </span>
              <strong>{rate(succeeded, total)}%</strong>
            </div>
            <ProgressBar
              value={rate(succeeded, total)}
              color="var(--success)"
              label={`Taxa de sucesso em ${CATEGORIES[category].label}`}
            />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

interface HistoryPageProps {
  goals: Goal[]
  actions: GoalActions
  onEditGoal: (goalId: number) => void
  onRepeatGoal: (goalId: number) => void
}

/** Os objetivos já avaliados, com o resultado, agrupados por mês. */
export function HistoryPage({ goals, actions, onEditGoal, onRepeatGoal }: HistoryPageProps) {
  const [outcome, setOutcome] = useState<GoalOutcome | 'todos'>('todos')
  const [category, setCategory] = useState<Category | 'todas'>('todas')

  const closed = goals.filter((goal) => goal.status === 'sucedido' || goal.status === 'nao_sucedido').sort(byClosedDesc)
  const inCategory = category === 'todas' ? closed : closed.filter((goal) => goal.category === category)
  const visible = outcome === 'todos' ? inCategory : inCategory.filter((goal) => goal.status === outcome)
  const countOf = (value: GoalOutcome) => inCategory.filter((goal) => goal.status === value).length

  const chip = (value: GoalOutcome | 'todos', label: string, count: number) => (
    <button
      type="button"
      className={outcome === value ? 'chip chip--active' : 'chip'}
      aria-pressed={outcome === value}
      onClick={() => setOutcome(value)}
    >
      {label}
      <span className="chip__count">{count}</span>
    </button>
  )

  return (
    <div className="page">
      <header className="page__intro">
        <h1>Histórico</h1>
        <p>Os objetivos que já avaliaste e o resultado de cada um.</p>
      </header>

      {closed.length === 0 ? (
        <div className="empty">
          <History size={22} aria-hidden />
          <p>Ainda não avaliaste nenhum objetivo.</p>
          <p>
            Quando o prazo de um objetivo terminar, regista o resultado no Painel, em "Por avaliar". Se acabares antes,
            escolhe o resultado ao editá-lo.
          </p>
        </div>
      ) : (
        <>
          <Summary closed={closed} />

          <div className="history-page__grid">
            <section className="history-page__list" aria-label="Objetivos avaliados">
              <div className="toolbar">
                <div className="chips" role="group" aria-label="Filtrar por resultado">
                  {chip('todos', 'Todos', inCategory.length)}
                  {chip('sucedido', 'Sucedidos', countOf('sucedido'))}
                  {chip('nao_sucedido', 'Não sucedidos', countOf('nao_sucedido'))}
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
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="empty">Nenhum objetivo avaliado corresponde a estes filtros.</p>
              ) : (
                groupByMonth(visible).map((group) => (
                  <section key={group.label} className="panel history-month">
                    <h2 className="history-month__title">
                      {group.label}
                      <span className="panel__count">{group.goals.length}</span>
                    </h2>
                    <ul className="history">
                      {group.goals.map((goal) => (
                        <HistoryItem
                          key={goal.id}
                          goal={goal}
                          onEdit={onEditGoal}
                          onReopen={actions.reopenGoal}
                          onRepeat={onRepeatGoal}
                          detailed
                        />
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </section>

            <SuccessByCategory closed={closed} />
          </div>
        </>
      )}
    </div>
  )
}
