import { CircleCheck, CircleX, Hourglass, Target, type LucideIcon } from 'lucide-react'
import type { GoalStatus } from '../types'

export interface StatusInfo {
  label: string
  /** Rótulo no plural, para filtros e contagens. */
  plural: string
  /** Variável CSS com a cor do estado. */
  color: string
  icon: LucideIcon
}

export const STATUSES: Record<GoalStatus, StatusInfo> = {
  em_curso: { label: 'Em curso', plural: 'Em curso', color: 'var(--primary)', icon: Target },
  por_avaliar: { label: 'Por avaliar', plural: 'Por avaliar', color: 'var(--warning)', icon: Hourglass },
  sucedido: { label: 'Sucedido', plural: 'Sucedidos', color: 'var(--success)', icon: CircleCheck },
  nao_sucedido: { label: 'Não sucedido', plural: 'Não sucedidos', color: 'var(--danger)', icon: CircleX },
}

/** Ordem em que os estados aparecem: primeiro o que precisa de ação. */
export const STATUS_ORDER: GoalStatus[] = ['por_avaliar', 'em_curso', 'sucedido', 'nao_sucedido']
