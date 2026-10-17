import { useState } from 'react'
import type { Goal, PageId } from '../types'
import { daysBetween, describeDaysLeft } from '../utils/date'
import { byDeadline } from '../utils/goals'

/** Prazos a esta distância (ou menos) aparecem nas notificações. */
const DEADLINE_DAYS = 7

export interface AppNotification {
  /** Inclui a data limite: se o prazo mudar, a notificação volta a aparecer como nova. */
  id: string
  kind: 'avaliar' | 'prazo'
  title: string
  text: string
  /** Página que abre ao carregar na notificação. */
  page: PageId
}

/** Calculadas a partir dos objetivos: não há notificações guardadas no servidor. */
function buildNotifications(goals: Goal[], today: string): AppNotification[] {
  const toReview = goals
    .filter((goal) => goal.status === 'por_avaliar')
    .sort(byDeadline)
    .map((goal): AppNotification => ({
      id: `avaliar-${goal.id}-${goal.targetDate}`,
      kind: 'avaliar',
      title: goal.title,
      text: `${describeDaysLeft(daysBetween(today, goal.targetDate))}. Regista o resultado.`,
      page: 'painel',
    }))
  const deadlines = goals
    .filter((goal) => goal.status === 'em_curso' && daysBetween(today, goal.targetDate) <= DEADLINE_DAYS)
    .sort(byDeadline)
    .map((goal): AppNotification => ({
      id: `prazo-${goal.id}-${goal.targetDate}`,
      kind: 'prazo',
      title: goal.title,
      text: `${describeDaysLeft(daysBetween(today, goal.targetDate))}. Vê os passos que faltam.`,
      page: 'planos',
    }))
  return [...toReview, ...deadlines]
}

function readSeen(key: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

/** As notificações e quais já foram vistas (guardado no localStorage, por conta). */
export function useNotifications(goals: Goal[], today: string, userId: number, ready: boolean) {
  const key = `edupath.notificacoes.${userId}`
  const [seen, setSeen] = useState(() => readSeen(key))
  // Enquanto os objetivos não chegam, não há notificações (nem se marcam como vistas).
  const notifications = ready ? buildNotifications(goals, today) : []

  return {
    notifications,
    unseenIds: notifications.filter((item) => !seen.includes(item.id)).map((item) => item.id),
    markAllSeen: () => {
      if (!ready) return
      // Guarda só as atuais, para a lista não crescer para sempre.
      const ids = notifications.map((item) => item.id)
      setSeen(ids)
      try {
        localStorage.setItem(key, JSON.stringify(ids))
      } catch {
        // Sem localStorage: ficam vistas só até recarregar.
      }
    },
  }
}
