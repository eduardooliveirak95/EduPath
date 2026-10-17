import type { CSSProperties } from 'react'
import { CATEGORIES } from '../../data/categories'
import type { Category } from '../../types'

export function CategoryBadge({ category }: { category: Category }) {
  const { label, color, icon: Icon } = CATEGORIES[category]
  return (
    <span className="badge" style={{ '--badge-color': color } as CSSProperties}>
      <Icon size={13} strokeWidth={2.4} aria-hidden />
      {label}
    </span>
  )
}
