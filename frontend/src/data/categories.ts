import { BookOpen, Briefcase, Heart, PiggyBank, Sparkles, type LucideIcon } from 'lucide-react'
import type { Category } from '../types'

export interface CategoryInfo {
  label: string
  /** Variável CSS com a cor da categoria. */
  color: string
  icon: LucideIcon
}

export const CATEGORIES: Record<Category, CategoryInfo> = {
  saude: { label: 'Saúde', color: 'var(--cat-saude)', icon: Heart },
  carreira: { label: 'Carreira', color: 'var(--cat-carreira)', icon: Briefcase },
  financas: { label: 'Finanças', color: 'var(--cat-financas)', icon: PiggyBank },
  aprendizagem: { label: 'Aprendizagem', color: 'var(--cat-aprendizagem)', icon: BookOpen },
  pessoal: { label: 'Pessoal', color: 'var(--cat-pessoal)', icon: Sparkles },
}
