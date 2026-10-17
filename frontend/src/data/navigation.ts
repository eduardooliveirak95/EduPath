import { History, LayoutDashboard, ListChecks, Settings, ShieldCheck, Target, type LucideIcon } from 'lucide-react'
import type { PageId } from '../types'

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'painel', label: 'Painel', icon: LayoutDashboard },
  { id: 'objetivos', label: 'Objetivos', icon: Target },
  { id: 'planos', label: 'Planos', icon: ListChecks },
  { id: 'historico', label: 'Histórico', icon: History },
]

export const SETTINGS_ITEM: NavItem = { id: 'definicoes', label: 'Definições', icon: Settings }

/** Só aparece (e só abre) na conta do administrador. */
export const ADMIN_ITEM: NavItem = { id: 'administracao', label: 'Administração', icon: ShieldCheck }

const PAGE_IDS: PageId[] = [...NAV_ITEMS.map((item) => item.id), SETTINGS_ITEM.id, ADMIN_ITEM.id]

// A página ativa fica no endereço (ex.: /#/objetivos), para recarregar e voltar atrás funcionarem.
// O Painel não tem nada depois do #.

export function pageFromUrl(): PageId {
  const id = window.location.hash.replace(/^#\/?/, '')
  return PAGE_IDS.find((page) => page === id) ?? 'painel'
}

export function pageUrl(page: PageId): string {
  const { pathname, search } = window.location
  return page === 'painel' ? pathname + search : `${pathname}${search}#/${page}`
}
