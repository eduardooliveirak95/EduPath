import { useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, LogIn, Route, UserPlus } from 'lucide-react'
import { ApiError } from '../../api/client'
import type { NewAccount } from '../../types'
import { clearInviteFromUrl, inviteCodeFromUrl } from '../../utils/inviteLink'
import '../../components/layout/layout.css'
import './login.css'

/** Igual ao mínimo da API (MIN_PASSWORD_LENGTH em backend/app/schemas.py). */
const MIN_PASSWORD_LENGTH = 10

type Mode = 'entrar' | 'criar'

interface LoginPageProps {
  /** Aviso a mostrar por cima do formulário (ex.: a sessão terminou). */
  notice: string | null
  onSignIn: (email: string, password: string) => Promise<void>
  onRegister: (account: NewAccount) => Promise<void>
}

export function LoginPage({ notice, onSignIn, onRegister }: LoginPageProps) {
  const passwordRef = useRef<HTMLInputElement>(null)
  // Com um link de convite, começa em "Criar conta" com o código preenchido.
  const [invitedCode] = useState(inviteCodeFromUrl)
  const [mode, setMode] = useState<Mode>(invitedCode ? 'criar' : 'entrar')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [inviteCode, setInviteCode] = useState(invitedCode ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const creating = mode === 'criar'

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setPassword('')
    setRepeatPassword('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (creating && password !== repeatPassword) {
      setError('As passwords não coincidem.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (creating) {
        await onRegister({ name: name.trim(), email: email.trim(), password, inviteCode: inviteCode.trim() })
        clearInviteFromUrl()
      } else {
        await onSignIn(email.trim(), password)
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível continuar.')
      setSubmitting(false)
      if (!creating) {
        // Seleciona a password, para escrever outra vez por cima.
        passwordRef.current?.focus()
        passwordRef.current?.select()
      }
    }
  }

  return (
    <main className="login">
      {/* key: ao mudar de modo, os campos são novos e o autoFocus vai para o primeiro. */}
      <form key={mode} className="login__card" onSubmit={submit}>
        <div className="login__brand">
          <span className="brand-logo" aria-hidden>
            <Route size={20} strokeWidth={2.4} />
          </span>
          <span className="brand-name">EduPath</span>
        </div>

        <div className="login__intro">
          <h1>{creating ? 'Criar conta' : 'Entrar'}</h1>
          <p>
            {!creating
              ? 'Entra na tua conta para veres os teus objetivos.'
              : invitedCode
                ? 'Recebeste um convite para o EduPath. Preenche os teus dados para criares a conta.'
                : 'Para criar uma conta precisas de um código de convite.'}
          </p>
        </div>

        {notice && !creating && (
          <p className="login__notice" role="status">
            {notice}
          </p>
        )}

        {creating && (
          <label className="field">
            <span className="field__label">Nome</span>
            <input
              className="input"
              name="name"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              autoFocus
            />
          </label>
        )}

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
            autoFocus={!creating}
          />
        </label>

        {/* A dica fica fora do <label>, senão passava a fazer parte do nome do campo. */}
        <div className="field">
          <label className="field__label" htmlFor="login-password">
            Password
          </label>
          <input
            ref={passwordRef}
            id="login-password"
            className="input"
            type="password"
            name="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={creating ? MIN_PASSWORD_LENGTH : undefined}
            maxLength={200}
            required
            aria-describedby={creating ? 'login-password-hint' : undefined}
          />
          {creating && (
            <span id="login-password-hint" className="field__hint">
              Pelo menos {MIN_PASSWORD_LENGTH} caracteres.
            </span>
          )}
        </div>

        {creating && (
          <>
            <label className="field">
              <span className="field__label">Repetir password</span>
              <input
                className="input"
                type="password"
                name="repeat-password"
                autoComplete="new-password"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                maxLength={200}
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Código de convite</span>
              <input
                className="input"
                name="invite-code"
                autoComplete="off"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                maxLength={200}
                required
              />
            </label>
          </>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary login__submit" disabled={submitting}>
          {submitting ? (
            <LoaderCircle className="spin" size={18} aria-hidden />
          ) : creating ? (
            <UserPlus size={18} aria-hidden />
          ) : (
            <LogIn size={18} aria-hidden />
          )}
          {creating ? 'Criar conta' : 'Entrar'}
        </button>

        <p className="login__switch">
          {creating ? 'Já tens conta?' : 'Ainda não tens conta?'}{' '}
          <button type="button" className="link-btn" onClick={() => switchMode(creating ? 'entrar' : 'criar')}>
            {creating ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </form>
    </main>
  )
}
