import { useState } from 'react'
import { Plus, Target } from 'lucide-react'
import type { GoalActions } from '../../hooks/useGoals'
import type { Goal, GoalStatus, PageId } from '../../types'
import { ActiveGoals } from './ActiveGoals'
import { NextSteps } from './NextSteps'
import { RecentHistory } from './RecentHistory'
import { ReviewPanel } from './ReviewPanel'
import { StatsRow } from './StatsRow'
import { UpcomingDeadlines } from './UpcomingDeadlines'
import './dashboard.css'

function greeting(hour: number): string {
  if (hour < 6) return 'Boa noite'
  if (hour < 13) return 'Bom dia'
  if (hour < 20) return 'Boa tarde'
  return 'Boa noite'
}

interface DashboardProps {
  userName: string
  goals: Goal[]
  today: string
  actions: GoalActions
  onNewGoal: () => void
  onEditGoal: (goalId: number) => void
  onShowProgress: (goalId: number) => void
  onNavigate: (page: PageId) => void
}

export function Dashboard({
  userName,
  goals,
  today,
  actions,
  onNewGoal,
  onEditGoal,
  onShowProgress,
  onNavigate,
}: DashboardProps) {
  const [hour] = useState(() => new Date().getHours())
  const withStatus = (...statuses: GoalStatus[]) => goals.filter((goal) => statuses.includes(goal.status))

  const active = withStatus('em_curso')
  const toReview = withStatus('por_avaliar')
  const closed = withStatus('sucedido', 'nao_sucedido')
  const succeeded = closed.filter((goal) => goal.status === 'sucedido').length
  const averageProgress =
    active.length === 0 ? 0 : Math.round(active.reduce((sum, goal) => sum + goal.progress, 0) / active.length)

  if (goals.length === 0) {
    return (
      <div className="dashboard">
        <section className="welcome">
          <span className="welcome__icon" aria-hidden>
            <Target size={28} />
          </span>
          <h1>Bem-vindo ao EduPath</h1>
          <p>Define o teu primeiro objetivo, divide-o em passos e acompanha o progresso até à data limite.</p>
          <button type="button" className="btn btn--primary" onClick={onNewGoal}>
            <Plus size={18} strokeWidth={2.5} aria-hidden /> Criar o primeiro objetivo
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard__intro">
        <h1>
          {greeting(hour)}, {userName.split(' ')[0]} 👋
        </h1>
        <p>
          Tens <strong>{active.length} {active.length === 1 ? 'objetivo' : 'objetivos'} em curso</strong>
          {toReview.length > 0 && (
            <>
              {' '}
              e <strong>{toReview.length} à espera de avaliação</strong>
            </>
          )}
          .
        </p>
      </header>

      <StatsRow
        activeCount={active.length}
        averageProgress={averageProgress}
        succeeded={succeeded}
        closed={closed.length}
        toReviewCount={toReview.length}
      />

      <div className="dashboard__grid">
        <div className="dashboard__column">
          <ActiveGoals
            goals={active}
            today={today}
            onNewGoal={onNewGoal}
            onEditGoal={onEditGoal}
            onShowProgress={onShowProgress}
            onCheckin={actions.setCheckin}
            onShowAll={() => onNavigate('objetivos')}
          />
          <NextSteps goals={active} onCompleteStep={(goalId, stepId) => actions.setStepDone(goalId, stepId, true)} />
        </div>
        <div className="dashboard__column">
          <ReviewPanel goals={toReview} today={today} onEvaluate={actions.evaluateGoal} onEdit={onEditGoal} />
          <UpcomingDeadlines goals={active} today={today} />
          <RecentHistory
            goals={closed}
            onReopen={actions.reopenGoal}
            onEdit={onEditGoal}
            onShowAll={() => onNavigate('historico')}
          />
        </div>
      </div>
    </div>
  )
}
