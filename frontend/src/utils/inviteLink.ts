// O convite pode ir num link: https://<site>/?convite=ABCD-2345-EFGH abre o ecrã
// "Criar conta" com o código já preenchido.
const INVITE_PARAM = 'convite'

export function inviteLink(code: string): string {
  const url = new URL(window.location.pathname, window.location.origin)
  url.searchParams.set(INVITE_PARAM, code)
  return url.toString()
}

/** O código de convite que veio no endereço, se houver. */
export function inviteCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get(INVITE_PARAM)
}

/** Tira o código do endereço (depois de criar a conta, já não serve). */
export function clearInviteFromUrl(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(INVITE_PARAM)) return
  url.searchParams.delete(INVITE_PARAM)
  window.history.replaceState(null, '', url)
}
