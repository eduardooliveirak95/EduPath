import { useEffect, useState, type CSSProperties } from 'react'
import { LoaderCircle, Plus, Ticket, X } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { CopyButton } from '../../components/ui/CopyButton'
import { Panel } from '../../components/ui/Panel'
import type { Invite, InviteStatus } from '../../types'
import { formatShortDate } from '../../utils/date'
import { inviteLink } from '../../utils/inviteLink'

const STATUS_LABEL: Record<InviteStatus, string> = {
  por_usar: 'Por usar',
  usado: 'Usado',
  expirado: 'Expirado',
}

const STATUS_COLOR: Record<InviteStatus, string> = {
  por_usar: 'var(--primary)',
  usado: 'var(--success)',
  expirado: 'var(--text-subtle)',
}

function describe(invite: Invite): string {
  if (invite.status === 'usado') {
    const when = invite.usedOn ? ` a ${formatShortDate(invite.usedOn)}` : ''
    return invite.usedBy ? `${invite.usedBy} criou conta${when}` : `Usado${when}`
  }
  const until = formatShortDate(invite.expiresOn)
  return invite.status === 'expirado' ? `Era válido até ${until}` : `Válido até ${until}`
}

function InviteItem({ invite, onRemove }: { invite: Invite; onRemove: (invite: Invite) => void }) {
  const pending = invite.status === 'por_usar'
  return (
    <li className={pending ? 'invite' : 'invite invite--closed'}>
      <div className="invite__main">
        <div className="invite__title">
          <code className="invite__code">{invite.code}</code>
          <span className="badge" style={{ '--badge-color': STATUS_COLOR[invite.status] } as CSSProperties}>
            {STATUS_LABEL[invite.status]}
          </span>
        </div>
        <span className="invite__meta">{describe(invite)}</span>
      </div>
      <div className="invite__actions">
        {pending && (
          <CopyButton text={inviteLink(invite.code)} label="Copiar link" promptMessage="Copia o link do convite:" />
        )}
        <button
          type="button"
          className="ghost-btn"
          onClick={() => onRemove(invite)}
          aria-label={pending ? `Cancelar o convite ${invite.code}` : `Tirar o convite ${invite.code} da lista`}
          title={pending ? 'Cancelar convite' : 'Tirar da lista'}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </li>
  )
}

/** Convites criados por esta conta: cada um serve para uma pessoa criar a sua conta. */
export function InvitesPanel() {
  // null enquanto a lista não chega.
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.listInvites().then(
      (result) => {
        if (!cancelled) setInvites(result)
      },
      (caught: unknown) => {
        if (!cancelled) setError(errorMessage(caught))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const create = async () => {
    setCreating(true)
    setCreated(false)
    setError(null)
    try {
      const invite = await api.createInvite()
      setInvites((current) => [invite, ...(current ?? [])])
      setCreated(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setCreating(false)
    }
  }

  const remove = async (invite: Invite) => {
    setCreated(false)
    setError(null)
    try {
      await api.deleteInvite(invite.id)
      setInvites((current) => current?.filter((item) => item.id !== invite.id) ?? null)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Panel
      title="Convites"
      icon={<Ticket size={18} aria-hidden />}
      // 7 dias: INVITE_DAYS em backend/app/routers/invites.py.
      subtitle="Para alguém criar conta, envia-lhe um convite. Cada um serve uma só vez e expira ao fim de 7 dias."
    >
      <div className="invites">
        {invites === null && !error && (
          <p className="invites__empty">
            <LoaderCircle className="spin" size={16} aria-hidden /> A carregar os convites…
          </p>
        )}
        {invites?.length === 0 && <p className="invites__empty">Ainda não criaste convites.</p>}
        {invites && invites.length > 0 && (
          <ul className="invite-list">
            {invites.map((invite) => (
              <InviteItem key={invite.id} invite={invite} onRemove={remove} />
            ))}
          </ul>
        )}
        {created && (
          <p className="form-success" role="status">
            Convite criado. Copia o link e envia-o a quem quiseres convidar.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="invites__actions">
          <button type="button" className="btn btn--primary" onClick={create} disabled={creating}>
            <Plus size={16} aria-hidden />
            {creating ? 'A criar…' : 'Criar convite'}
          </button>
        </div>
      </div>
    </Panel>
  )
}
