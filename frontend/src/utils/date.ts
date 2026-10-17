const DAY_MS = 86_400_000

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / DAY_MS)
}

const shortFormat = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' })
const longFormat = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
const weekdayFormat = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

export function formatShortDate(iso: string): string {
  return shortFormat.format(parseISODate(iso)).replace('.', '')
}

export function formatLongDate(iso: string): string {
  return longFormat.format(parseISODate(iso))
}

/** Dia de uma data com hora (ex.: o `createdAt` de uma conta). As datas AAAA-MM-DD usam parseISODate. */
export function formatTimestampDate(timestamp: string): string {
  return longFormat.format(new Date(timestamp))
}

export function formatWeekday(iso: string): string {
  return weekdayFormat.format(parseISODate(iso))
}

/** Texto amigável para o tempo que falta (ou que passou) até uma data. */
export function describeDaysLeft(days: number): string {
  if (days === 0) return 'Termina hoje'
  if (days === 1) return 'Termina amanhã'
  if (days > 1) return `Faltam ${days} dias`
  if (days === -1) return 'Terminou ontem'
  return `Terminou há ${-days} dias`
}
