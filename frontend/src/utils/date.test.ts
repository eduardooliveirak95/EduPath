import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, describeDaysLeft, formatWeekday, parseISODate, toISODate } from './date'

describe('datas AAAA-MM-DD', () => {
  it('lê e escreve na hora local, sem mudar de dia', () => {
    const date = parseISODate('2026-06-15')
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 5, 15, 0])
    expect(toISODate(date)).toBe('2026-06-15')
    // new Date('2026-06-15') seria meia-noite em UTC: noutros fusos podia dar o dia 14.
    expect(toISODate(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01')
  })

  it('soma dias, mudando de mês e de ano', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('conta os dias certos quando a hora muda', () => {
    // Em Portugal, a hora muda a 29 de março e a 25 de outubro de 2026.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(daysBetween('2026-06-15', '2026-06-10')).toBe(-5)
  })

  it('escreve as datas em português, no dia certo', () => {
    expect(formatWeekday('2026-10-20')).toBe('terça-feira, 20 de outubro')
  })
})

describe('describeDaysLeft', () => {
  it.each([
    [0, 'Termina hoje'],
    [1, 'Termina amanhã'],
    [5, 'Faltam 5 dias'],
    [-1, 'Terminou ontem'],
    [-3, 'Terminou há 3 dias'],
  ])('%i dias → "%s"', (days, text) => {
    expect(describeDaysLeft(days)).toBe(text)
  })
})
