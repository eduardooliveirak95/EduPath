import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Download, KeyRound, Trash2, UserRound } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { Panel } from '../../components/ui/Panel'
import type { AuthActions } from '../../hooks/useAuth'
import type { User } from '../../types'
import { toISODate } from '../../utils/date'
import { exportFileName, goalsToCsv, goalsToJson } from '../../utils/export'
import './settings.css'

/** Igual ao mínimo da API (MIN_PASSWORD_LENGTH em backend/app/schemas.py). */
const MIN_PASSWORD_LENGTH = 10

type FormState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'done'; message: string } | { kind: 'error'; message: string }

function FormFeedback({ state }: { state: FormState }) {
  if (state.kind === 'error') {
    return (
      <p className="form-error" role="alert">
        {state.message}
      </p>
    )
  }
  if (state.kind === 'done') {
    return (
      <p className="form-success" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function ProfileForm({ user, onUpdateProfile }: { user: User; onUpdateProfile: AuthActions['updateProfile'] }) {
  const [name, setName] = useState(user.name)
  const [state, setState] = useState<FormState>({ kind: 'idle' })
  const unchanged = name.trim() === user.name

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setState({ kind: 'saving' })
    try {
      await onUpdateProfile(name.trim())
      setState({ kind: 'done', message: 'Nome guardado.' })
    } catch (caught) {
      setState({ kind: 'error', message: errorMessage(caught) })
    }
  }

  return (
    <Panel title="Conta" icon={<UserRound size={18} aria-hidden />}>
      <form className="settings-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Nome</span>
          <input
            className="input"
            autoComplete="given-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setState({ kind: 'idle' })
            }}
            maxLength={100}
            required
          />
        </label>
        <div className="field">
          <span className="field__label">Email</span>
          <p className="settings-form__value">{user.email}</p>
        </div>
        <FormFeedback state={state} />
        <div className="settings-form__actions">
          <button type="submit" className="btn btn--primary" disabled={unchanged || state.kind === 'saving'}>
            {state.kind === 'saving' ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

function PasswordForm({ email, onChangePassword }: { email: string; onChangePassword: AuthActions['changePassword'] }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword !== repeatPassword) {
      setState({ kind: 'error', message: 'As passwords novas não coincidem.' })
      return
    }
    setState({ kind: 'saving' })
    try {
      await onChangePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setRepeatPassword('')
      setState({ kind: 'done', message: 'Password mudada. As sessões noutros dispositivos terminaram.' })
    } catch (caught) {
      setState({ kind: 'error', message: errorMessage(caught) })
    }
  }

  return (
    <Panel
      title="Password"
      icon={<KeyRound size={18} aria-hidden />}
      subtitle="Ao mudá-la, as sessões noutros dispositivos terminam."
    >
      <form className="settings-form" onSubmit={submit}>
        {/* Para o gestor de passwords saber de que conta é a password. */}
        <input type="email" name="email" autoComplete="username" value={email} hidden readOnly />
        <label className="field">
          <span className="field__label">Password atual</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            maxLength={200}
            required
          />
        </label>
        {/* A dica fica fora do <label>, senão passava a fazer parte do nome do campo. */}
        <div className="field">
          <label className="field__label" htmlFor="new-password">
            Password nova
          </label>
          <input
            id="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={200}
            required
            aria-describedby="new-password-hint"
          />
          <span id="new-password-hint" className="field__hint">
            Pelo menos {MIN_PASSWORD_LENGTH} caracteres.
          </span>
        </div>
        <label className="field">
          <span className="field__label">Repetir password nova</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            maxLength={200}
            required
          />
        </label>
        <FormFeedback state={state} />
        <div className="settings-form__actions">
          <button type="submit" className="btn btn--primary" disabled={state.kind === 'saving'}>
            {state.kind === 'saving' ? 'A mudar…' : 'Mudar password'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

/** Descarrega um ficheiro feito no browser. */
function download(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Só depois de o browser começar a descarregar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function ExportPanel({ user }: { user: User }) {
  const [state, setState] = useState<FormState>({ kind: 'idle' })

  // Pede os objetivos à API na altura, para o ficheiro ter tudo o que está guardado.
  const exportAs = async (format: 'csv' | 'json') => {
    setState({ kind: 'saving' })
    try {
      const goals = await api.listGoals()
      const now = new Date()
      const fileName = exportFileName(toISODate(now), format)
      if (format === 'csv') download(fileName, goalsToCsv(goals), 'text/csv;charset=utf-8')
      else download(fileName, goalsToJson(user, goals, now.toISOString()), 'application/json')
      setState({ kind: 'done', message: `Descarregado: ${fileName}` })
    } catch (caught) {
      setState({ kind: 'error', message: errorMessage(caught) })
    }
  }

  return (
    <Panel
      title="Os teus dados"
      icon={<Download size={18} aria-hidden />}
      subtitle="Uma cópia dos teus objetivos e planos, para guardares."
    >
      <div className="settings-form">
        <p className="settings-form__text">
          O CSV abre numa folha de cálculo (Excel, Google Sheets ou Numbers). O JSON tem tudo o que está guardado,
          incluindo os identificadores e as datas de criação.
        </p>
        <FormFeedback state={state} />
        <div className="settings-form__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => exportAs('json')}
            disabled={state.kind === 'saving'}
          >
            Descarregar JSON
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => exportAs('csv')}
            disabled={state.kind === 'saving'}
          >
            Descarregar CSV
          </button>
        </div>
      </div>
    </Panel>
  )
}

interface DeleteAccountPanelProps {
  email: string
  onDeleteAccount: AuthActions['deleteAccount']
}

/** Só nas contas que não são do administrador: a dele não se apaga (a API também recusa). */
function DeleteAccountPanel({ email, onDeleteAccount }: DeleteAccountPanelProps) {
  const passwordRef = useRef<HTMLInputElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })

  const askToConfirm = () => {
    // O botão desaparece; o foco passa para a password, que é o passo seguinte.
    flushSync(() => setConfirming(true))
    passwordRef.current?.focus()
  }

  const cancel = () => {
    setConfirming(false)
    setPassword('')
    setState({ kind: 'idle' })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setState({ kind: 'saving' })
    try {
      // Se correr bem, a sessão termina e aparece o ecrã de entrada (esta página desaparece).
      await onDeleteAccount(password)
    } catch (caught) {
      setState({ kind: 'error', message: errorMessage(caught) })
    }
  }

  return (
    <Panel
      title="Apagar a conta"
      icon={<Trash2 size={18} aria-hidden />}
      subtitle="Apaga a conta e todos os teus objetivos e planos. Não dá para desfazer."
    >
      {confirming ? (
        <form className="settings-form" onSubmit={submit}>
          <input type="email" name="email" autoComplete="username" value={email} hidden readOnly />
          <label className="field">
            <span className="field__label">Password, para confirmar</span>
            <input
              ref={passwordRef}
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={200}
              required
            />
          </label>
          <FormFeedback state={state} />
          <div className="settings-form__actions">
            <button type="button" className="btn btn--ghost" onClick={cancel} disabled={state.kind === 'saving'}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--danger-strong" disabled={state.kind === 'saving'}>
              <Trash2 size={16} aria-hidden /> {state.kind === 'saving' ? 'A apagar…' : 'Apagar para sempre'}
            </button>
          </div>
        </form>
      ) : (
        <div className="settings-form">
          <p className="settings-form__text">
            Se quiseres guardar os teus objetivos, descarrega-os antes em "Os teus dados". Para voltares a usar o
            EduPath depois, precisas de um convite novo.
          </p>
          <div className="settings-form__actions">
            <button type="button" className="btn btn--danger" onClick={askToConfirm}>
              <Trash2 size={16} aria-hidden /> Apagar a minha conta
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}

interface SettingsPageProps extends AuthActions {
  user: User
}

export function SettingsPage({ user, updateProfile, changePassword, deleteAccount }: SettingsPageProps) {
  return (
    <div className="settings">
      <header className="settings__intro">
        <h1>Definições</h1>
        <p>A tua conta no EduPath.</p>
      </header>
      <ProfileForm user={user} onUpdateProfile={updateProfile} />
      <PasswordForm email={user.email} onChangePassword={changePassword} />
      <ExportPanel user={user} />
      {!user.isAdmin && <DeleteAccountPanel email={user.email} onDeleteAccount={deleteAccount} />}
    </div>
  )
}
