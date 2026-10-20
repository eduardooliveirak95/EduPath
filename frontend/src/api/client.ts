import type {
  AdminUser,
  Goal,
  GoalChanges,
  GoalOutcome,
  Invite,
  NewAccount,
  NewGoal,
  PlanStep,
  Session,
  TemporaryPassword,
  User,
} from '../types'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Mensagem a mostrar quando uma ação falha. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado.'
}

const UNREACHABLE = 'Não foi possível ligar ao servidor. Tenta novamente daqui a pouco.'

/** Erros de proxy/gateway: o servidor da API não respondeu. */
const GATEWAY_ERRORS = new Set([502, 503, 504])

// Sessão: o token e a conta ficam no localStorage, para sobreviverem a fechar o separador.
// Sem localStorage (ex.: bloqueado pelo browser), duram até a página ser fechada.
const SESSION_KEY = 'edupath.session'

interface StoredSession {
  token: string
  user: User
}

function readStoredSession(): StoredSession | null {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    return typeof stored?.token === 'string' && stored.user ? stored : null
  } catch {
    // Inclui o formato antigo (só o token, do login sem contas), que já não serve.
    return null
  }
}

let current = readStoredSession()

function saveSession(value: StoredSession | null) {
  current = value
  try {
    if (value === null) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify(value))
  } catch {
    // Fica só em memória.
  }
}

function startSession(session: Session): User {
  saveSession({ token: session.token, user: session.user })
  return session.user
}

const sessionEndedListeners = new Set<() => void>()

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const sentToken = current?.token ?? null
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (sentToken !== null) headers.Authorization = `Bearer ${sentToken}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(UNREACHABLE, 0)
  }

  // Token expirado ou recusado: termina a sessão e a app volta ao ecrã de login.
  // Só se for o token atual, para um pedido antigo não terminar uma sessão nova.
  if (response.status === 401 && sentToken !== null && sentToken === current?.token) {
    saveSession(null)
    sessionEndedListeners.forEach((listener) => listener())
  }

  if (GATEWAY_ERRORS.has(response.status)) {
    // Um 503 da própria API traz a explicação em `detail` (ex.: login por configurar).
    const isApiError = response.headers.get('content-type')?.includes('application/json')
    if (!isApiError) throw new ApiError(UNREACHABLE, response.status)
  }
  if (!response.ok) throw new ApiError(await readErrorMessage(response), response.status)
  return (response.status === 204 ? undefined : await response.json()) as T
}

/** O FastAPI devolve `detail` como texto ou como lista de erros de validação. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const { detail } = await response.json()
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((error: { msg: string }) => error.msg.replace(/^Value error, /, '')).join(' ')
    }
  } catch {
    // Resposta sem JSON (ex.: página de erro do alojamento).
  }
  return `O servidor respondeu com erro ${response.status}.`
}

export const auth = {
  /** Conta com sessão iniciada neste browser, ou null. */
  currentUser: () => current?.user ?? null,

  signIn: async (email: string, password: string) =>
    startSession(await request<Session>('/api/auth/login', 'POST', { email, password })),

  register: async (account: NewAccount) =>
    startSession(await request<Session>('/api/auth/register', 'POST', account)),

  /** Troca o token por um novo, para a sessão não expirar enquanto a app é usada.
   * Devolve a conta atualizada, ou null se entretanto a sessão terminou ou mudou. */
  refresh: async () => {
    const sentToken = current?.token
    const session = await request<Session>('/api/auth/refresh', 'POST')
    return current?.token === sentToken ? startSession(session) : null
  },

  updateProfile: async (name: string) => {
    const user = await request<User>('/api/auth/me', 'PATCH', { name })
    if (current) saveSession({ ...current, user })
    return user
  },

  /** As outras sessões da conta terminam; esta recebe um token novo. */
  changePassword: async (currentPassword: string, newPassword: string) =>
    startSession(await request<Session>('/api/auth/password', 'POST', { currentPassword, newPassword })),

  signOut: () => saveSession(null),

  /** Avisa quando a API recusa o token (ex.: sessão expirada). Devolve a função para cancelar. */
  onSessionEnded: (listener: () => void) => {
    sessionEndedListeners.add(listener)
    return () => {
      sessionEndedListeners.delete(listener)
    }
  },
}

export const api = {
  listGoals: () => request<Goal[]>('/api/goals'),

  createGoal: (goal: NewGoal) => request<Goal>('/api/goals', 'POST', goal),

  updateGoal: (goalId: number, changes: GoalChanges) => request<Goal>(`/api/goals/${goalId}`, 'PATCH', changes),

  deleteGoal: (goalId: number) => request<void>(`/api/goals/${goalId}`, 'DELETE'),

  evaluateGoal: (goalId: number, outcome: GoalOutcome, note?: string) =>
    request<Goal>(`/api/goals/${goalId}/evaluation`, 'POST', { outcome, note }),

  reopenGoal: (goalId: number) => request<Goal>(`/api/goals/${goalId}/evaluation`, 'DELETE'),

  /** Acrescenta um passo no fim do plano. */
  addStep: (goalId: number, title: string) => request<PlanStep>(`/api/goals/${goalId}/steps`, 'POST', { title }),

  updateStep: (goalId: number, stepId: number, changes: Partial<Pick<PlanStep, 'title' | 'done'>>) =>
    request<PlanStep>(`/api/goals/${goalId}/steps/${stepId}`, 'PATCH', changes),

  // Só para o administrador (as outras contas recebem 403).
  listAccounts: () => request<AdminUser[]>('/api/admin/users'),

  /** Apaga a conta e tudo o que é dela (objetivos e passos). */
  deleteAccount: (userId: number) => request<void>(`/api/admin/users/${userId}`, 'DELETE'),

  /** Dá uma password nova à conta; a antiga deixa de servir e as sessões dela terminam. */
  resetPassword: (userId: number) =>
    request<TemporaryPassword>(`/api/admin/users/${userId}/password`, 'POST'),

  listInvites: () => request<Invite[]>('/api/invites'),

  createInvite: () => request<Invite>('/api/invites', 'POST'),

  /** Cancela um convite por usar, ou tira da lista um usado ou expirado. */
  deleteInvite: (inviteId: number) => request<void>(`/api/invites/${inviteId}`, 'DELETE'),
}
