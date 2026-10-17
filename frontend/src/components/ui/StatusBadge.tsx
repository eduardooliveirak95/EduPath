import type { CSSProperties } from 'react'
import { STATUSES } from '../../data/statuses'
import type { GoalStatus } from '../../types'

export function StatusBadge({ status }: { status: GoalStatus }) {
  const { label, color, icon: Icon } = STATUSES[status]
  return (
    <span className="badge" style={{ '--badge-color': color } as CSSProperties}>
      <Icon size={13} strokeWidth={2.4} aria-hidden />
      {label}
    </span>
  )
}
