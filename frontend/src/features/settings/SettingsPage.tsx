import { useState, type FormEvent } from 'react'
import { KeyRound, UserRound } from 'lucide-react'
import { errorMessage } from '../../api/client'
import { Panel } from '../../components/ui/Panel'
import type { AuthActions } from '../../hooks/useAuth'
import type { User } from '../../types'
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

interface SettingsPageProps extends AuthActions {
  user: User
}

export function SettingsPage({ user, updateProfile, changePassword }: SettingsPageProps) {
  return (
    <div className="settings">
      <header className="settings__intro">
        <h1>Definições</h1>
        <p>A tua conta no EduPath.</p>
      </header>
      <ProfileForm user={user} onUpdateProfile={updateProfile} />
      <PasswordForm email={user.email} onChangePassword={changePassword} />
    </div>
  )
}
