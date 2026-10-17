import { useEffect, useRef, useState } from 'react'
import { Bell, CalendarClock, Hourglass } from 'lucide-react'
import type { AppNotification } from '../../hooks/useNotifications'
import './layout.css'

interface NotificationsMenuProps {
  notifications: AppNotification[]
  unseenIds: string[]
  onOpen: () => void
  onSelect: (notification: AppNotification) => void
}

/** O sino da barra de topo: mostra quantas notificações são novas e abre a lista. */
export function NotificationsMenu({ notifications, unseenIds, onOpen, onSelect }: NotificationsMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // As que eram novas quando a lista abriu (ao abrir, passam todas a vistas).
  const [freshIds, setFreshIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      setFreshIds(unseenIds)
      onOpen()
    }
    setOpen(!open)
  }

  const select = (notification: AppNotification) => {
    setOpen(false)
    onSelect(notification)
  }

  const unseen = unseenIds.length
  return (
    <div className="notifications-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn topbar__bell"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="notificacoes"
        aria-label={unseen > 0 ? `Notificações (${unseen} ${unseen === 1 ? 'nova' : 'novas'})` : 'Notificações'}
      >
        <Bell size={18} aria-hidden />
        {unseen > 0 && (
          <span className="topbar__badge" aria-hidden>
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <section id="notificacoes" className="notifications" aria-label="Notificações">
          <h2 className="notifications__title">Notificações</h2>
          {notifications.length === 0 ? (
            <p className="notifications__empty">
              Não tens notificações. Aparecem aqui os objetivos por avaliar e os prazos dos próximos 7 dias.
            </p>
          ) : (
            <ul className="notifications__list">
              {notifications.map((notification) => {
                const review = notification.kind === 'avaliar'
                return (
                  <li key={notification.id}>
                    <button type="button" className="notification" onClick={() => select(notification)}>
                      <span className={review ? 'notification__icon is-review' : 'notification__icon'} aria-hidden>
                        {review ? <Hourglass size={16} /> : <CalendarClock size={16} />}
                      </span>
                      <span className="notification__body">
                        <span className="notification__title">
                          {notification.title}
                          {freshIds.includes(notification.id) && <span className="notification__new">Nova</span>}
                        </span>
                        <span className="notification__text">
                          {review ? 'Por avaliar' : 'Prazo a chegar'} · {notification.text}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
