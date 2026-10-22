import { describe, expect, it } from 'vitest'
import { canCheckIn, checkinsThisWeek, toggleDay, weekOf } from './habits'

describe('weekOf', () => {
  it('vai de segunda a domingo', () => {
    const week = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']
    expect(weekOf('2026-10-22')).toEqual(week) // quinta-feira
    expect(weekOf('2026-10-19')).toEqual(week) // segunda
    expect(weekOf('2026-10-25')).toEqual(week) // domingo
    expect(weekOf('2026-10-26')[0]).toBe('2026-10-26')
  })
})

describe('checkinsThisWeek', () => {
  it('conta só os dias desta semana', () => {
    expect(checkinsThisWeek({ checkins: ['2026-10-18', '2026-10-19', '2026-10-21'] }, '2026-10-22')).toBe(2)
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
