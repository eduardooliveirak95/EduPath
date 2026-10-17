import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  icon?: ReactNode
  count?: number
  subtitle?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function Panel({ title, icon, count, subtitle, action, className, children }: PanelProps) {
  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      <header className="panel__header">
        <div>
          <h2 className="panel__title">
            {icon}
            {title}
            {count !== undefined && <span className="panel__count">{count}</span>}
          </h2>
          {subtitle && <p className="panel__subtitle">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}
