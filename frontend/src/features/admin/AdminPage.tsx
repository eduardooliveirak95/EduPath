import { useEffect, useState, type CSSProperties } from 'react'
import { LoaderCircle, Users } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { Panel } from '../../components/ui/Panel'
import type { AdminUser } from '../../types'
import { formatTimestampDate } from '../../utils/date'
import { InvitesPanel } from './InvitesPanel'
import '../../components/layout/page.css'
import './admin.css'

/** As contas que existem. Só o nome, o email e a data: os objetivos de cada pessoa são privados. */
function AccountsPanel() {
  // null enquanto a lista não chega.
  const [accounts, setAccounts] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.listAccounts().then(
      (result) => {
        if (!cancelled) setAccounts(result)
      },
      (caught: unknown) => {
        if (!cancelled) setError(errorMessage(caught))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Panel
      title="Contas"
      icon={<Users size={18} aria-hidden />}
      count={accounts?.length}
      subtitle="Quem tem conta no EduPath. Os objetivos de cada pessoa são privados e não aparecem aqui."
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {accounts === null && !error && (
        <p className="invites__empty">
          <LoaderCircle className="spin" size={16} aria-hidden /> A carregar as contas…
        </p>
      )}
      {accounts && (
        <ul className="account-list">
          {accounts.map((account) => (
            <li key={account.id} className="account-row">
              <span className="account__avatar" aria-hidden>
                {account.name.charAt(0).toUpperCase()}
              </span>
              <div className="account-row__info">
                <p className="account-row__name">
                  {account.name}
                  {account.isAdmin && (
                    <span className="badge" style={{ '--badge-color': 'var(--primary)' } as CSSProperties}>
                      Administrador
                    </span>
                  )}
                </p>
                <p className="account-row__email">{account.email}</p>
              </div>
              <span className="account-row__since">Desde {formatTimestampDate(account.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** Só para a conta do administrador: as contas que existem e os convites. */
export function AdminPage() {
  return (
    <div className="page admin">
      <header className="page__intro">
        <h1>Administração</h1>
        <p>Só tu vês esta página. Daqui convidas pessoas para o EduPath.</p>
      </header>
      <AccountsPanel />
      <InvitesPanel />
    </div>
  )
}
