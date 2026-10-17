import type { CSSProperties } from 'react'
import { Hourglass, Target, TrendingUp, Trophy, type LucideIcon } from 'lucide-react'

interface Stat {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  color: string
}

interface StatsRowProps {
  activeCount: number
  averageProgress: number
  succeeded: number
  closed: number
  toReviewCount: number
}

export function StatsRow({ activeCount, averageProgress, succeeded, closed, toReviewCount }: StatsRowProps) {
  const successRate = closed === 0 ? 0 : Math.round((succeeded / closed) * 100)

  const stats: Stat[] = [
    { label: 'Em curso', value: String(activeCount), hint: 'objetivos ativos', icon: Target, color: 'var(--primary)' },
    {
      label: 'Progresso médio',
      value: `${averageProgress}%`,
      hint: 'nos objetivos em curso',
      icon: TrendingUp,
      color: 'var(--cat-carreira)',
    },
    {
      label: 'Taxa de sucesso',
      value: `${successRate}%`,
      hint: `${succeeded} de ${closed} objetivos alcançados`,
      icon: Trophy,
      color: 'var(--success)',
    },
    {
      label: 'Por avaliar',
      value: String(toReviewCount),
      hint: 'com o prazo terminado',
      icon: Hourglass,
      color: 'var(--warning)',
    },
  ]

  return (
    <section className="stats" aria-label="Resumo">
      {stats.map(({ label, value, hint, icon: Icon, color }) => (
        <article key={label} className="stat" style={{ '--stat-color': color } as CSSProperties}>
          <span className="stat__icon" aria-hidden>
            <Icon size={20} />
          </span>
          <div>
            <p className="stat__label">{label}</p>
            <p className="stat__value">{value}</p>
            <p className="stat__hint">{hint}</p>
          </div>
        </article>
      ))}
    </section>
  )
}
