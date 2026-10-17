import type { ReactNode } from 'react'
import { CalendarDays, Menu, Plus, Search } from 'lucide-react'
import { formatWeekday } from '../../utils/date'
import './layout.css'

interface TopbarProps {
  today: string
  query: string
  onSearch: (query: string) => void
  onOpenMenu: () => void
  onNewGoal: () => void
  /** O sino das notificações (NotificationsMenu). */
  notifications: ReactNode
}

export function Topbar({ today, query, onSearch, onOpenMenu, onNewGoal, notifications }: TopbarProps) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn topbar__menu" onClick={onOpenMenu} aria-label="Abrir menu">
        <Menu size={20} />
      </button>

      <label className="search">
        <Search size={17} aria-hidden />
        <span className="visually-hidden">Procurar</span>
        <input
          type="search"
          placeholder="Procurar objetivos ou planos…"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          maxLength={100}
        />
      </label>

      <div className="topbar__actions">
        <span className="topbar__date">
          <CalendarDays size={16} aria-hidden />
          {formatWeekday(today)}
        </span>
        {notifications}
        <button type="button" className="btn btn--primary" onClick={onNewGoal}>
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          <span className="topbar__new-label">Novo objetivo</span>
        </button>
      </div>
    </header>
  )
}
