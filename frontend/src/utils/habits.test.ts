import { describe, expect, it } from 'vitest'
import {
  canCheckIn,
  checkinsIn,
  currentWeekIndex,
  isCheckedIn,
  toggleDay,
  weekLabel,
  weekOf,
  weekState,
} from './habits'

describe('weekOf', () => {
  it('vai de segunda a domingo', () => {
    const week = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']
    expect(weekOf('2026-10-22')).toEqual(week) // quinta-feira
    expect(weekOf('2026-10-19')).toEqual(week) // segunda
    expect(weekOf('2026-10-25')).toEqual(week) // domingo
    expect(weekOf('2026-10-26')[0]).toBe('2026-10-26')
  })
})

describe('checkinsIn', () => {
  it('conta só os dias da semana (dentro do objetivo)', () => {
    const checkins = ['2026-10-18', '2026-10-19', '2026-10-21', '2026-10-24']
    expect(checkinsIn({ checkins }, { start: '2026-10-19', end: '2026-10-25' })).toBe(3)
    // Avaliado na quinta: o sábado já não conta.
    expect(checkinsIn({ checkins }, { start: '2026-10-19', end: '2026-10-22' })).toBe(2)
  })
})

describe('isCheckedIn', () => {
  it('só os dias marcados dentro da semana do objetivo', () => {
    const goal = { checkins: ['2026-10-19', '2026-10-21', '2026-10-23'] }
    // Terminou na quarta: a sexta ficou marcada, mas já não conta.
    const week = { start: '2026-10-19', end: '2026-10-21' }
    expect(isCheckedIn(goal, week, '2026-10-21')).toBe(true)
    expect(isCheckedIn(goal, week, '2026-10-20')).toBe(false)
    expect(isCheckedIn(goal, week, '2026-10-23')).toBe(false)
  })
})

describe('weekState', () => {
  const week = { start: '2026-10-19', end: '2026-10-25', needed: 3, done: 0 }

  it('cumprida com os dias pedidos, mesmo antes de acabar', () => {
    expect(weekState(week, 3, '2026-10-21')).toBe('cumprida')
    expect(weekState(week, 4, '2026-11-02')).toBe('cumprida')
  })

  it('sem os dias pedidos: em curso, não cumprida depois de acabar, ou por vir', () => {
    expect(weekState(week, 2, '2026-10-25')).toBe('em_curso')
    expect(weekState(week, 2, '2026-10-26')).toBe('nao_cumprida')
    expect(weekState(week, 0, '2026-10-18')).toBe('por_vir')
  })
})

describe('weekLabel', () => {
  it('esta semana e a passada, mesmo cortadas pelo início ou pelo fim do objetivo', () => {
    expect(weekLabel({ start: '2026-10-26' }, '2026-10-28')).toBe('Esta semana')
    expect(weekLabel({ start: '2026-10-19' }, '2026-10-28')).toBe('Semana passada')
    // Começou na quinta, 22: a semana não tem a segunda-feira.
    expect(weekLabel({ start: '2026-10-22' }, '2026-10-27')).toBe('Semana passada')
    expect(weekLabel({ start: '2026-10-22' }, '2026-10-25')).toBe('Esta semana')
  })

  it('as outras, de segunda a domingo', () => {
    expect(weekLabel({ start: '2026-10-12' }, '2026-10-28')).toBe('Semana de 12/10 a 18/10')
    expect(weekLabel({ start: '2026-10-01' }, '2026-10-28')).toBe('Semana de 28/09 a 4/10')
  })
})

describe('currentWeekIndex', () => {
  const weeks = [{ end: '2026-10-25' }, { end: '2026-11-01' }, { end: '2026-11-04' }]

  it('a semana de hoje, a primeira antes do início ou a última depois do fim', () => {
    expect(currentWeekIndex(weeks, '2026-10-27')).toBe(1)
    expect(currentWeekIndex(weeks, '2026-11-01')).toBe(1)
    expect(currentWeekIndex(weeks, '2026-10-01')).toBe(0)
    expect(currentWeekIndex(weeks, '2026-11-20')).toBe(2)
  })
})

describe('canCheckIn', () => {
  const goal = { startDate: '2026-10-20', targetDate: '2026-10-24', outcome: null }

  it('só entre o início e hoje, até à data limite', () => {
    expect(canCheckIn(goal, '2026-10-19', '2026-10-22')).toBe(false)
    expect(canCheckIn(goal, '2026-10-20', '2026-10-22')).toBe(true)
    expect(canCheckIn(goal, '2026-10-22', '2026-10-22')).toBe(true)
    expect(canCheckIn(goal, '2026-10-23', '2026-10-22')).toBe(false)
    expect(canCheckIn(goal, '2026-10-25', '2026-10-27')).toBe(false)
  })

  it('não num objetivo já avaliado', () => {
    expect(canCheckIn({ ...goal, outcome: 'sucedido' }, '2026-10-21', '2026-10-22')).toBe(false)
  })
})

describe('toggleDay', () => {
  it('acrescenta por ordem, sem repetir, ou tira', () => {
    expect(toggleDay(['2026-10-19', '2026-10-21'], '2026-10-20', true)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21'])
    expect(toggleDay(['2026-10-19'], '2026-10-19', true)).toEqual(['2026-10-19'])
    expect(toggleDay(['2026-10-19', '2026-10-21'], '2026-10-19', false)).toEqual(['2026-10-21'])
  })
})
