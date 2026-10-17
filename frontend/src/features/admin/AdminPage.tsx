import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LoaderCircle, Trash2, Users } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { Panel } from '../../components/ui/Panel'
import type { AdminUser } from '../../types'
import { formatTimestampDate } from '../../utils/date'
import { InvitesPanel } from './InvitesPanel'
import '../../components/layout/page.css'
import './admin.css'

interface AccountRowProps {
  account: AdminUser
  onRemove: (account: AdminUser) => Promise<void>
}

/** Uma conta. As que não são de administrador podem ser removidas, com confirmação no próprio cartão. */
function AccountRow({ account, onRemove }: AccountRowProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Ao pedir confirmação, o foco vai para "Cancelar", para um Enter a mais não apagar nada.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  const remove = async () => {
    setRemoving(true)
    // Se correr bem, a conta sai da lista; se falhar, o erro aparece no painel.
    await onRemove(account)
    setRemoving(false)
  }

  return (
    <li className="account-row">
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
      {!account.isAdmin && !confirming && (
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setConfirming(true)}
          aria-label={`Remover a conta de ${account.name}`}
          title="Remover conta"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      )}
      {confirming && (
        <div className="account-row__confirm">
          <p>
            Remover a conta de <strong>{account.name}</strong>? Os objetivos e os planos desta pessoa também são
            apagados, e não dá para desfazer.
          </p>
          <div className="account-row__actions">
            <button
              ref={cancelRef}
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setConfirming(false)}
              disabled={removing}
            >
              Cancelar
            </button>
            <button type="button" className="btn btn--danger-strong btn--sm" onClick={remove} disabled={removing}>
              {removing ? 'A remover…' : 'Remover conta'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

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

  const remove = async (account: AdminUser) => {
    setError(null)
    try {
      await api.deleteAccount(account.id)
      setAccounts((current) => current?.filter((item) => item.id !== account.id) ?? null)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

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
            <AccountRow key={account.id} account={account} onRemove={remove} />
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
