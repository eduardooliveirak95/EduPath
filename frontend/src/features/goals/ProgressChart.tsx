import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Goal, ProgressPoint } from '../../types'
import { formatLongDate, formatShortDate } from '../../utils/date'
import { chartRange, dayFraction, describeProgress, stepPath } from '../../utils/progress'

const HEIGHT = 220
const MARGIN = { top: 22, right: 46, bottom: 28, left: 42 }
const TICKS = [0, 25, 50, 75, 100]

interface ProgressChartProps {
  points: ProgressPoint[]
  goal: Pick<Goal, 'startDate' | 'targetDate' | 'closedAt'>
  today: string
}

/**
 * A percentagem ao longo do tempo (na cor de `--chart-color`), em degraus (mantém-se até mudar), e a linha do ritmo
 * constante: 0% no início e 100% na data limite. Passar o rato ou usar as setas mostra cada registo.
 */
export function ProgressChart({ points, goal, today }: ProgressChartProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  // A largura vem do espaço disponível, para o texto do gráfico ter sempre o mesmo tamanho.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const range = chartRange(points, goal, today)
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const x = (day: string) => MARGIN.left + dayFraction(day, range) * plotWidth
  const y = (progress: number) => MARGIN.top + (1 - progress / 100) * plotHeight

  const line = stepPath(points, range.lineEnd, x, y)
  const area = line && `${line}V${y(0)}H${x(points[0].day)}Z`
  const last = points.at(-1)
  const showToday = !goal.closedAt && today > range.from && today < range.to
  const current = active === null ? null : points[active]

  const nearest = (event: PointerEvent<SVGSVGElement>) => {
    const pointerX = event.clientX - event.currentTarget.getBoundingClientRect().left
    let best = 0
    points.forEach((point, index) => {
      if (Math.abs(x(point.day) - pointerX) < Math.abs(x(points[best].day) - pointerX)) best = index
    })
    setActive(best)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: (active ?? points.length) - 1,
      ArrowRight: (active ?? -1) + 1,
      Home: 0,
      End: points.length - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    setActive(Math.min(Math.max(moves[event.key], 0), points.length - 1))
  }

  return (
    <div
      ref={boxRef}
      className="progress-chart"
      tabIndex={0}
      aria-label="Gráfico da evolução. Usa as setas para ver cada registo."
      onKeyDown={onKeyDown}
      onFocus={() => setActive(points.length - 1)}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={describeProgress(points)}
          onPointerMove={nearest}
          onPointerLeave={() => setActive(null)}
        >
          {TICKS.map((tick) => (
            <g key={tick}>
              <line
                className="progress-chart__grid"
                x1={MARGIN.left}
                x2={MARGIN.left + plotWidth}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text className="progress-chart__tick" x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end">
                {tick}%
              </text>
            </g>
          ))}
          <text className="progress-chart__tick" x={MARGIN.left} y={HEIGHT - 8}>
            {formatShortDate(range.from)}
          </text>
          <text className="progress-chart__tick" x={MARGIN.left + plotWidth} y={HEIGHT - 8} textAnchor="end">
            {formatShortDate(range.to)}
          </text>
          {showToday && (
            <g>
              <line className="progress-chart__today" x1={x(today)} x2={x(today)} y1={MARGIN.top} y2={y(0)} />
              <text className="progress-chart__tick" x={x(today)} y={MARGIN.top - 8} textAnchor="middle">
                hoje
              </text>
            </g>
          )}

          <line
            className="progress-chart__pace"
            x1={x(goal.startDate)}
            y1={y(0)}
            x2={x(goal.targetDate)}
            y2={y(100)}
          />
          <path className="progress-chart__area" d={area} />
          <path className="progress-chart__line" d={line} />

          {current && (
            <line
              className="progress-chart__crosshair"
              x1={x(current.day)}
              x2={x(current.day)}
              y1={MARGIN.top}
              y2={y(0)}
            />
          )}
          {points.map((point, index) => (
            <circle
              key={point.day}
              className="progress-chart__dot"
              cx={x(point.day)}
              cy={y(point.progress)}
              r={index === active ? 5.5 : 4}
            />
          ))}
          {last && (
            <text className="progress-chart__end" x={x(range.lineEnd) + 8} y={y(last.progress) + 4}>
              {last.progress}%
            </text>
          )}
        </svg>
      )}

      {current && (
        <div
          className="progress-chart__tooltip"
          style={{ left: Math.min(Math.max(x(current.day), 60), width - 60), top: y(current.progress) - 12 }}
        >
          <strong>{current.progress}%</strong>
          <span>{formatLongDate(current.day)}</span>
        </div>
      )}
      <p className="visually-hidden" aria-live="polite">
        {current && `${current.progress}% a ${formatLongDate(current.day)}`}
      </p>
    </div>
  )
}
