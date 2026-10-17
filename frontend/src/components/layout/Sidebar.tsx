import { LogOut, Route, X } from 'lucide-react'
import { ADMIN_ITEM, NAV_ITEMS, SETTINGS_ITEM, type NavItem } from '../../data/navigation'
import type { PageId, User } from '../../types'
import './layout.css'

interface SidebarProps {
  user: User
  active: PageId
  open: boolean
  onNavigate: (page: PageId) => void
  onClose: () => void
  onSignOut: () => void
}

export function Sidebar({ user, active, open, onNavigate, onClose, onSignOut }: SidebarProps) {
  const renderItem = ({ id, label, icon: Icon }: NavItem) => (
    <li key={id}>
      <button
        type="button"
        className={id === active ? 'nav-link nav-link--active' : 'nav-link'}
        aria-current={id === active ? 'page' : undefined}
        onClick={() => onNavigate(id)}
      >
        <Icon size={19} aria-hidden />
        {label}
      </button>
    </li>
  )

  return (
    <aside className={open ? 'sidebar sidebar--open' : 'sidebar'} aria-label="Navegação principal">
      <div className="sidebar__brand">
        <span className="brand-logo" aria-hidden>
          <Route size={20} strokeWidth={2.4} />
        </span>
        <span className="brand-name">EduPath</span>
        <button type="button" className="icon-btn sidebar__close" onClick={onClose} aria-label="Fechar menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar__nav">
        <ul>{NAV_ITEMS.map(renderItem)}</ul>
      </nav>

      <div className="sidebar__footer">
        <figure className="quote-card">
          <blockquote>“Um objetivo sem um plano é apenas um desejo.”</blockquote>
          <figcaption>Antoine de Saint-Exupéry</figcaption>
        </figure>
        <div className="account">
          <span className="account__avatar" aria-hidden>
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div className="account__info">
            <p className="account__name">{user.name}</p>
            <p className="account__email">{user.email}</p>
          </div>
        </div>
        <ul>
          {user.isAdmin && renderItem(ADMIN_ITEM)}
          {renderItem(SETTINGS_ITEM)}
          <li>
            <button type="button" className="nav-link" onClick={onSignOut}>
              <LogOut size={19} aria-hidden />
              Terminar sessão
            </button>
          </li>
        </ul>
      </div>
    </aside>
  )
}
