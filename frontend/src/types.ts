// Espelha os esquemas da API (backend/app/schemas.py). Mantém os dois em sincronia.

export type Category = 'saude' | 'carreira' | 'financas' | 'aprendizagem' | 'pessoal'

/** Resultado registado quando o objetivo é avaliado. */
export type GoalOutcome = 'sucedido' | 'nao_sucedido'

/** Estado calculado pela API a partir da data limite e do resultado registado. */
export type GoalStatus = 'em_curso' | 'por_avaliar' | GoalOutcome

export interface PlanStep {
  id: number
  title: string
  done: boolean
  position: number
}

export interface Goal {
  id: number
  title: string
  description: string | null
  category: Category
  /** Datas em formato ISO (AAAA-MM-DD). */
  startDate: string
  targetDate: string
  /** Percentagem de conclusão do objetivo (0–100). */
  progress: number
  status: GoalStatus
  plan: PlanStep[]
  outcome: GoalOutcome | null
  outcomeNote: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NewGoal {
  title: string
  description?: string
  category: Category
  startDate: string
  targetDate: string
  progress: number
  plan: { title: string }[]
}

/** Alterações a um objetivo (PATCH): só os campos enviados mudam. */
export interface GoalChanges {
  title?: string
  description?: string | null
  category?: Category
  startDate?: string
  targetDate?: string
  progress?: number
  /** Substitui o plano todo: passos com `id` mantêm-se, sem `id` são novos, os que faltam são apagados. */
  plan?: { id?: number; title: string; done: boolean }[]
  /** Nota da avaliação: só em objetivos já avaliados; `null` apaga-a. */
  outcomeNote?: string | null
}

export interface User {
  id: number
  name: string
  email: string
  /** O administrador vê a página Administração e é o único que cria convites. */
  isAdmin: boolean
}

/** Uma conta, vista pelo administrador: só que existe (nada dos objetivos dela). */
export interface AdminUser extends User {
  /** Data e hora em ISO (com hora, ao contrário das datas dos objetivos). */
  createdAt: string
}

/** Sessão devolvida ao entrar: o token vai no cabeçalho Authorization de cada pedido. */
export interface Session {
  token: string
  expiresAt: string
  user: User
}

export interface NewAccount {
  name: string
  email: string
  password: string
  inviteCode: string
}

/** Estado de um convite, calculado pela API. */
export type InviteStatus = 'por_usar' | 'usado' | 'expirado'

/** Convite criado nas Definições: o código serve uma vez para criar uma conta. */
export interface Invite {
  id: number
  /** Código a dar a quem vai criar a conta (ex.: ABCD-2345-EFGH). */
  code: string
  status: InviteStatus
  /** Último dia em que o código serve (AAAA-MM-DD). */
  expiresOn: string
  usedOn: string | null
  /** Nome de quem criou a conta com este convite. */
  usedBy: string | null
}

export type PageId = 'painel' | 'objetivos' | 'planos' | 'historico' | 'definicoes' | 'administracao'
