import { describe, it, expect } from 'vitest'
import { scoreKnockoutMatches } from './engine'
import type { Bets, KnockoutMatch } from './types'

const bets = {
  participants: ['Julle', 'Dee', 'Aaron', 'Niina', 'Pasi'],
  knockout: {
    quarterfinalists: { slots: 8, pointsPerTeam: 5, picks: { Julle: ['Meksiko', 'Brasilia'], Dee: ['Meksiko'], Aaron: ['Brasilia'] } },
    semifinalists: { slots: 4, pointsPerTeam: 6, picks: { Niina: ['Meksiko'] } },
    finalists: { slots: 2, pointsPerTeam: 8, picks: {} },
    champion: { pointsPerTeam: 12, picks: { Pasi: 'Meksiko' } },
  },
} as unknown as Bets

const km = (o: Partial<KnockoutMatch>): KnockoutMatch => ({
  id: 'k1', stage: 'R16', date: 'su 28.6.', time: '19:00', home: 'Meksiko', away: 'Brasilia',
  homeScore: null, awayScore: null, finished: false, live: false, minute: null, winner: null, ...o,
})

describe('scoreKnockoutMatches', () => {
  it('R16 prize round: Top 8 backers per team (+5), no per-name points', () => {
    const [r] = scoreKnockoutMatches(bets, [km({ stage: 'R16' })])
    expect(r.prize).toEqual({ label: 'Top 8', points: 5 })
    expect(r.homeBackers.map((b) => b.name).sort()).toEqual(['Dee', 'Julle'])
    expect(r.awayBackers.map((b) => b.name).sort()).toEqual(['Aaron', 'Julle'])
    expect(r.homeBackers.every((b) => b.points === null)).toBe(true)
  })

  it('QF → Top 4 (+6), SF → Finalisti (+8), Final → Mestari (+12)', () => {
    expect(scoreKnockoutMatches(bets, [km({ stage: 'QF' })])[0].prize).toEqual({ label: 'Top 4', points: 6 })
    expect(scoreKnockoutMatches(bets, [km({ stage: 'SF' })])[0].prize).toEqual({ label: 'Finalisti', points: 8 })
    const fin = scoreKnockoutMatches(bets, [km({ stage: 'FINAL' })])[0]
    expect(fin.prize).toEqual({ label: 'Mestari', points: 12 })
    expect(fin.homeBackers.map((b) => b.name)).toEqual(['Pasi'])
  })

  it('R32: no prize; backers carry summed future points, sorted desc', () => {
    const [r] = scoreKnockoutMatches(bets, [km({ stage: 'R32' })])
    expect(r.prize).toBeNull()
    // Meksiko (home): Pasi=Mestari(12), Niina=Top4(6), Julle=Top8(5), Dee=Top8(5)
    expect(r.homeBackers.find((b) => b.name === 'Pasi')?.points).toBe(12)
    expect(r.homeBackers.find((b) => b.name === 'Niina')?.points).toBe(6)
    expect(r.homeBackers.find((b) => b.name === 'Julle')?.points).toBe(5)
    expect(r.homeBackers.map((b) => b.points)).toEqual([12, 6, 5, 5]) // sorted high → low
    expect(r.homeBackers[0].name).toBe('Pasi')
  })

  it('R32: sums points when a backer holds the team in multiple categories', () => {
    const multi = { ...bets, knockout: { ...bets.knockout,
      quarterfinalists: { slots: 8, pointsPerTeam: 5, picks: { Julle: ['Meksiko'] } },
      champion: { pointsPerTeam: 12, picks: { Julle: 'Meksiko' } },
      semifinalists: { slots: 4, pointsPerTeam: 6, picks: {} },
      finalists: { slots: 2, pointsPerTeam: 8, picks: {} },
    } } as unknown as Bets
    const [r] = scoreKnockoutMatches(multi, [km({ stage: 'R32' })])
    expect(r.homeBackers.find((b) => b.name === 'Julle')?.points).toBe(17) // 5 + 12
  })

  it('3rd-place match: no prize, no backers', () => {
    const [r] = scoreKnockoutMatches(bets, [km({ stage: '3RD' })])
    expect(r.prize).toBeNull()
    expect(r.homeBackers).toEqual([])
    expect(r.awayBackers).toEqual([])
  })

  it('undecided fixture (null teams) passes through with empty backers', () => {
    const [r] = scoreKnockoutMatches(bets, [km({ home: null, away: null })])
    expect(r.homeBackers).toEqual([])
    expect(r.awayBackers).toEqual([])
  })
})
