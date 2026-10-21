import type { Goal, ProgressPoint } from '../types'
import { daysBetween, formatShortDate } from './date'

/** O período que o gráfico mostra, em datas AAAA-MM-DD. */
export interface ChartRange {
  /** Primeiro dia: o início do objetivo, ou o primeiro registo se for anterior. */
  from: string
  /** Último dia: a data limite, ou o fim da linha se for depois. */
  to: string
  /** Até onde vai a linha do progresso: hoje, ou o dia da avaliação. */
  lineEnd: string
}

const later = (a: string, b: string) => (a > b ? a : b)
const earlier = (a: string, b: string) => (a < b ? a : b)

export function chartRange(
  points: ProgressPoint[],
  goal: Pick<Goal, 'startDate' | 'targetDate' | 'closedAt'>,
  today: string,
): ChartRange {
  const first = points[0]?.day ?? goal.startDate
  const last = points.at(-1)?.day ?? first
  // A percentagem mantém-se até mudar: a linha segue até hoje (ou até à avaliação).
  const lineEnd = later(goal.closedAt ?? today, last)
  return { from: earlier(goal.startDate, first), to: later(goal.targetDate, lineEnd), lineEnd }
}

/** Posição de um dia entre 0 (o início do período) e 1 (o fim). */
export function dayFraction(day: string, range: Pick<ChartRange, 'from' | 'to'>): number {
  const total = daysBetween(range.from, range.to)
  return total === 0 ? 0 : daysBetween(range.from, day) / total
}

/**
 * Linha em degraus: a percentagem mantém-se igual até ao registo seguinte, e a última segue até
 * `lineEnd`. Recebe as funções que passam o dia e a percentagem para coordenadas.
 */
export function stepPath(
  points: ProgressPoint[],
  lineEnd: string,
  x: (day: string) => number,
  y: (progress: number) => number,
): string {
  if (points.length === 0) return ''
  const parts = points.map((point, index) => {
    const px = x(point.day)
    const py = y(point.progress)
    return index === 0 ? `M${px},${py}` : `H${px}V${py}`
  })
  parts.push(`H${x(lineEnd)}`)
  return parts.join('')
}

/** Uma frase com o resumo da evolução (ex.: "De 0% a 45% desde 22 ago (+45 pontos)."). */
export function describeProgress(points: ProgressPoint[]): string {
  if (points.length === 0) return 'Ainda não há registos do progresso.'
  const first = points[0]
  const last = points.at(-1) as ProgressPoint
  if (points.length === 1) {
    return `${last.progress}% desde ${formatShortDate(first.day)}. A evolução aparece quando o progresso mudar.`
  }
  const change = last.progress - first.progress
  const signed = change > 0 ? `+${change}` : String(change)
  const unit = Math.abs(change) === 1 ? 'ponto' : 'pontos'
  return `De ${first.progress}% a ${last.progress}% desde ${formatShortDate(first.day)} (${signed} ${unit}).`
}
