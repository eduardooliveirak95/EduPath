import type { CSSProperties } from 'react'

interface ProgressBarProps {
  value: number
  color?: string
  label: string
}

export function ProgressBar({ value, color, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div
        className="progress__fill"
        style={{ width: `${clamped}%`, '--bar-color': color } as CSSProperties}
      />
    </div>
  )
}
