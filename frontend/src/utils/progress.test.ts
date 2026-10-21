import { describe, expect, it } from 'vitest'
import { chartRange, dayFraction, describeProgress, stepPath } from './progress'

const goal = { startDate: '2026-01-01', targetDate: '2026-12-31', closedAt: null }
const points = [
  { day: '2026-01-01', progress: 0 },
  { day: '2026-03-01', progress: 30 },
  { day: '2026-06-01', progress: 45 },
]

describe('chartRange', () => {
  it('vai do início à data limite, com a linha até hoje', () => {
    expect(chartRange(points, goal, '2026-07-10')).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
      lineEnd: '2026-07-10',
    })
  })

  it('num objetivo avaliado, a linha acaba no dia da avaliação', () => {
    expect(chartRange(points, { ...goal, closedAt: '2026-06-20' }, '2026-07-10').lineEnd).toBe('2026-06-20')
  })

  it('estica-se para caber registos de antes do início e dias depois do prazo', () => {
    const early = [{ day: '2025-12-20', progress: 10 }]
    expect(chartRange(early, { ...goal, targetDate: '2026-02-01' }, '2026-03-01')).toEqual({
      from: '2025-12-20',
      to: '2026-03-01',
      lineEnd: '2026-03-01',
    })
  })
})

describe('dayFraction', () => {
  it('dá a posição do dia no período', () => {
    const range = { from: '2026-01-01', to: '2026-01-11' }
    expect(dayFraction('2026-01-01', range)).toBe(0)
    expect(dayFraction('2026-01-06', range)).toBe(0.5)
    expect(dayFraction('2026-01-11', range)).toBe(1)
    expect(dayFraction('2026-01-01', { from: '2026-01-01', to: '2026-01-01' })).toBe(0)
  })
})

describe('stepPath', () => {
  // Um dia por unidade em x, desde 1 de janeiro; percentagem igual em y.
  const x = (day: string) => Number(day.slice(8)) - 1 + (Number(day.slice(5, 7)) - 1) * 100
  const y = (progress: number) => progress

  it('mantém cada valor até ao registo seguinte e o último até ao fim da linha', () => {
    expect(stepPath(points, '2026-07-10', x, y)).toBe('M0,0H200V30H500V45H609')
  })

  it('sem registos, não há linha', () => {
    expect(stepPath([], '2026-07-10', x, y)).toBe('')
  })
})

describe('describeProgress', () => {
  it('resume a evolução, com a diferença em pontos', () => {
    expect(describeProgress(points)).toMatch(/^De 0% a 45% desde .+ \(\+45 pontos\)\.$/)
    expect(describeProgress([points[2], { day: '2026-06-02', progress: 44 }])).toMatch(/\(-1 ponto\)\.$/)
  })

  it('com um só registo, explica que a evolução vem depois', () => {
    expect(describeProgress([points[1]])).toMatch(/^30% desde .+\. A evolução aparece quando o progresso mudar\.$/)
    expect(describeProgress([])).toBe('Ainda não há registos do progresso.')
  })
})
