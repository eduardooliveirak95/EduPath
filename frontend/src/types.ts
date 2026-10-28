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
  /** Percentagem de conclusão do objetivo (0–100). Com `progressFromSteps`, é a dos passos feitos. */
  progress: number
  /** O progresso é calculado pelos passos feitos, e não escolhido à mão. */
  progressFromSteps: boolean
  /** Objetivo recorrente: quantas vezes por semana (de segunda a domingo). O progresso é o dos dias feitos (até às vezes pedidas em cada semana). */
  timesPerWeek: number | null
  /** Dias registados num objetivo recorrente (AAAA-MM-DD), por ordem. */
  checkins: string[]
  /** Semanas de um objetivo recorrente, quantas foram cumpridas e cada uma, por ordem. */
  weeks: { met: number; total: number; results: WeekResult[] } | null
  status: GoalStatus
  plan: PlanStep[]
  outcome: GoalOutcome | null
  outcomeNote: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Uma semana de um objetivo recorrente: os dias dela que caem no objetivo (de segunda a domingo,
 * ou menos na primeira e na última), quantos pede e quantos foram feitos.
 */
export interface WeekResult {
  start: string
  end: string
  needed: number
  done: number
}

/** A percentagem de um objetivo num dia (o último valor desse dia), para a evolução do progresso. */
export interface ProgressPoint {
  day: string
  progress: number
}

export interface NewGoal {
  title: string
  description?: string
  category: Category
  startDate: string
  targetDate: string
  progress: number
  progressFromSteps: boolean
  timesPerWeek: number | null
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
  progressFromSteps?: boolean
  /** `null` deixa de ser recorrente. */
  timesPerWeek?: number | null
  /** Substitui o plano todo: passos com `id` mantêm-se, sem `id` são novos, os que faltam são apagados. */
  plan?: { id?: number; title: string; done: boolean }[]
  /** Avalia o objetivo (mesmo antes da data limite) ou muda o resultado; `null` anula a avaliação. */
  outcome?: GoalOutcome | null
  /** Nota da avaliação: só em objetivos avaliados; `null` apaga-a. */
  outcomeNote?: string | null
  /** Dia em que terminou, entre o início e hoje: só em objetivos avaliados (ao avaliar sem ele, fica hoje). */
  closedAt?: string
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

/** Password nova que o administrador dá a uma conta (ex.: ABCD-2345-EFGH). Só aparece uma vez. */
export interface TemporaryPassword {
  password: string
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
