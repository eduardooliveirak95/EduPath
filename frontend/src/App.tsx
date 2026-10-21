import { useEffect, useState } from 'react'
import { LoaderCircle, RotateCw, TriangleAlert, X } from 'lucide-react'
import { NotificationsMenu } from './components/layout/NotificationsMenu'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { pageFromUrl, pageUrl } from './data/navigation'
import { AdminPage } from './features/admin/AdminPage'
import { LoginPage } from './features/auth/LoginPage'
import { Dashboard } from './features/dashboard/Dashboard'
import { GoalDialog } from './features/goals/GoalDialog'
import { GoalsPage } from './features/goals/GoalsPage'
import { HistoryPage } from './features/history/HistoryPage'
import { PlansPage } from './features/plans/PlansPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { useAuth, type AuthActions } from './hooks/useAuth'
import { useGoals } from './hooks/useGoals'
import { useNotifications } from './hooks/useNotifications'
import type { PageId, User } from './types'
import { toISODate } from './utils/date'
import { repeatGoal } from './utils/goals'
import { onResume } from './utils/resume'
import './components/layout/layout.css'

export default function App() {
  const { user, notice, signIn, register, signOut, updateProfile, changePassword, deleteAccount } = useAuth()
  // Sem sessão, só o ecrã de entrada. Ao sair, o Workspace desmonta e esquece os dados.
  if (!user) return <LoginPage notice={notice} onSignIn={signIn} onRegister={register} />
  return <Workspace user={user} account={{ updateProfile, changePassword, deleteAccount }} onSignOut={signOut} />
}

interface WorkspaceProps {
  user: User
  account: AuthActions
  onSignOut: () => void
}

/** Formulário aberto: um objetivo novo, a edição de um que já existe, ou um novo igual a outro. */
type GoalDialogState = { mode: 'new' } | { mode: 'edit' | 'repeat'; goalId: number } | null

/** A app com sessão iniciada: navegação, páginas e ações sobre os objetivos. */
function Workspace({ user, account, onSignOut }: WorkspaceProps) {
  const [requestedPage, setPage] = useState<PageId>(pageFromUrl)
  // A Administração só abre na conta do administrador; nas outras, mostra o Painel.
  const page = requestedPage === 'administracao' && !user.isAdmin ? 'painel' : requestedPage
  const [menuOpen, setMenuOpen] = useState(false)
  // Pesquisa da barra de topo: mostra os resultados na página Objetivos.
  const [query, setQuery] = useState('')
  const [goalDialog, setGoalDialog] = useState<GoalDialogState>(null)
  const [today, setToday] = useState(() => toISODate(new Date()))
  const { goals, loadState, reload, actionError, dismissActionError, createGoal, updateGoal, deleteGoal, ...actions } =
    useGoals()
  const { notifications, unseenIds, markAllSeen } = useNotifications(goals, today, user.id, loadState.kind === 'ready')
  // Se o objetivo deixar de existir (ex.: foi apagado), o formulário fecha.
  const dialogGoal =
    goalDialog && goalDialog.mode !== 'new' ? goals.find((goal) => goal.id === goalDialog.goalId) : undefined
  const editingGoal = goalDialog?.mode === 'edit' ? dialogGoal : undefined
  const repeatedGoal = goalDialog?.mode === 'repeat' ? dialogGoal : undefined

  // Ao voltar à app, o dia pode já ser outro (os prazos e as notificações dependem dele).
  useEffect(() => onResume(() => setToday(toISODate(new Date()))), [])

  // Botões "voltar" e "avançar" do browser.
  useEffect(() => {
    const onPopState = () => setPage(pageFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (next: PageId) => {
    setMenuOpen(false)
    // A pesquisa só se aplica aos Objetivos: noutra página, o texto na caixa enganava.
    if (next !== 'objetivos') setQuery('')
    if (next === page) return
    window.history.pushState(null, '', pageUrl(next))
    setPage(next)
    window.scrollTo(0, 0)
  }

  const search = (text: string) => {
    setQuery(text)
    if (text.trim()) navigate('objetivos')
  }

  // Abre o formulário por cima da página atual; nas Definições, vai para o Painel, onde o objetivo aparece.
  const openNewGoal = () => {
    if (page === 'definicoes') navigate('painel')
    setGoalDialog({ mode: 'new' })
  }

  const openEditGoal = (goalId: number) => setGoalDialog({ mode: 'edit', goalId })

  const openRepeatGoal = (goalId: number) => setGoalDialog({ mode: 'repeat', goalId })

  const renderPage = () => {
    if (page === 'definicoes') return <SettingsPage user={user} {...account} />
    if (page === 'administracao') return <AdminPage />
    if (loadState.kind === 'loading') {
      return (
        <section className="status-panel" aria-live="polite">
          <LoaderCircle className="spin" size={28} aria-hidden />
          <p>A carregar os teus objetivos…</p>
        </section>
      )
    }
    if (loadState.kind === 'error') {
      return (
        <section className="status-panel status-panel--error" role="alert">
          <TriangleAlert size={28} aria-hidden />
          <h1>Não foi possível carregar os objetivos</h1>
          <p>{loadState.message}</p>
          <button type="button" className="btn btn--ghost" onClick={reload}>
            <RotateCw size={16} aria-hidden /> Tentar novamente
          </button>
        </section>
      )
    }
    switch (page) {
      case 'objetivos':
        return (
          <GoalsPage
            goals={goals}
            today={today}
            query={query}
            onClearQuery={() => setQuery('')}
            onNewGoal={openNewGoal}
            onEditGoal={openEditGoal}
            onRepeatGoal={openRepeatGoal}
          />
        )
      case 'planos':
        return (
          <PlansPage goals={goals} today={today} actions={actions} onNewGoal={openNewGoal} onEditGoal={openEditGoal} />
        )
      case 'historico':
        return (
          <HistoryPage goals={goals} actions={actions} onEditGoal={openEditGoal} onRepeatGoal={openRepeatGoal} />
        )
      default:
        return (
          <Dashboard
            userName={user.name}
            goals={goals}
            today={today}
            actions={actions}
            onNewGoal={openNewGoal}
            onEditGoal={openEditGoal}
            onNavigate={navigate}
          />
        )
    }
  }

  return (
    <div className="app">
      <Sidebar
        user={user}
        active={page}
        open={menuOpen}
        onNavigate={navigate}
        onClose={() => setMenuOpen(false)}
        onSignOut={onSignOut}
      />
      {menuOpen && (
        <button type="button" className="app__backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
      )}

      <div className="app__main">
        <Topbar
          today={today}
          query={query}
          onSearch={search}
          onOpenMenu={() => setMenuOpen(true)}
          onNewGoal={openNewGoal}
          notifications={
            <NotificationsMenu
              notifications={notifications}
              unseenIds={unseenIds}
              onOpen={markAllSeen}
              onSelect={(notification) => navigate(notification.page)}
            />
          }
        />
        <main className="app__content">{renderPage()}</main>
      </div>

      {(goalDialog?.mode === 'new' || dialogGoal) && (
        <GoalDialog
          key={dialogGoal ? `${goalDialog?.mode}-${dialogGoal.id}` : 'novo'}
          today={today}
          goal={editingGoal}
          draft={
            repeatedGoal && {
              goal: repeatGoal(repeatedGoal, today),
              heading: repeatedGoal.status === 'nao_sucedido' ? 'Tentar outra vez' : 'Repetir objetivo',
            }
          }
          onClose={() => setGoalDialog(null)}
          onCreate={createGoal}
          onUpdate={updateGoal}
          onDelete={deleteGoal}
        />
      )}

      {actionError && (
        <div className="toast" role="alert">
          <TriangleAlert size={18} aria-hidden />
          <span>{actionError}</span>
          <button type="button" className="toast__close" onClick={dismissActionError} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
