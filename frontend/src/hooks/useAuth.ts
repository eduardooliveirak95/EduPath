import { useEffect, useState } from 'react'
import { auth } from '../api/client'
import type { NewAccount, User } from '../types'
import { onResume } from '../utils/resume'

const SESSION_ENDED = 'A tua sessão terminou. Entra outra vez.'

/** A conta com sessão iniciada (ou null), e as ações para entrar, sair e mudar a conta. */
export function useAuth() {
  const [user, setUser] = useState(auth.currentUser)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(
    () =>
      auth.onSessionEnded(() => {
        setUser(null)
        setNotice(SESSION_ENDED)
      }),
    [],
  )

  // Ao abrir o site com sessão iniciada, e ao voltar à app depois de algum tempo, renova o
  // token: assim só expira se a app ficar sem ser usada durante o prazo da sessão. Se o token
  // já não for válido, o onSessionEnded trata disso; outros erros (ex.: sem rede) ficam para a próxima.
  useEffect(() => {
    const renew = () => {
      if (!auth.currentUser()) return
      auth.refresh().then(
        (fresh) => {
          if (fresh) setUser(fresh)
        },
        () => {},
      )
    }
    renew()
    return onResume(renew)
  }, [])

  const enter = (next: User) => {
    setNotice(null)
    setUser(next)
  }

  // Todas lançam ApiError se falharem, para o formulário mostrar o erro.
  return {
    user,
    /** Mensagem para o ecrã de entrada (ex.: sessão expirada). */
    notice,
    signIn: async (email: string, password: string) => enter(await auth.signIn(email, password)),
    register: async (account: NewAccount) => enter(await auth.register(account)),
    updateProfile: async (name: string) => setUser(await auth.updateProfile(name)),
    changePassword: async (currentPassword: string, newPassword: string) =>
      setUser(await auth.changePassword(currentPassword, newPassword)),
    signOut: () => {
      auth.signOut()
      setNotice(null)
      setUser(null)
    },
  }
}

export type AuthActions = Pick<ReturnType<typeof useAuth>, 'updateProfile' | 'changePassword'>
