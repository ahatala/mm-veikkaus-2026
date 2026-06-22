import { describe, it, expect } from 'vitest'
// @ts-expect-error - plain JS module, no types
import { analyzeGroup } from '../../scripts/clinch.mjs'

const P = (home: string, away: string, hs: number, as: number) => ({ home, away, homeScore: hs, awayScore: as, finished: true })
const U = (home: string, away: string) => ({ home, away, homeScore: null, awayScore: null, finished: false })
const sorted = (a: string[]) => [...a].sort()

describe('analyzeGroup', () => {
  it('decides nothing before any match is played', () => {
    const r = analyzeGroup([U('A', 'B'), U('A', 'C'), U('A', 'D'), U('B', 'C'), U('B', 'D'), U('C', 'D')])
    expect(r.complete).toBe(false)
    expect(r.clinchedFirst).toBeNull()
    expect(r.clinchedTop2).toEqual([])
    expect(r.eliminatedFromFirst).toEqual([])
    expect(r.top2OrderLocked).toBeNull()
  })

  it('clinches 1st with a round to spare, but not the exact 2nd place', () => {
    // After 2 rounds: A=6, D=2, B=1, C=1, each with 1 game left. A is uncatchable; 2nd still open.
    const r = analyzeGroup([
      P('A', 'B', 1, 0), P('C', 'D', 0, 0), P('A', 'C', 1, 0), P('B', 'D', 0, 0),
      U('A', 'D'), U('B', 'C'),
    ])
    expect(r.clinchedFirst).toBe('A')
    expect(r.clinchedTop2).toEqual(['A'])
    expect(r.top2OrderLocked).toBeNull()
    expect(sorted(r.eliminatedFromFirst)).toEqual(['B', 'C', 'D'])
  })

  it('locks both qualifiers as a set even when 1st/2nd order is undecided', () => {
    // A and B each won their two cross matches (6 pts) and only meet each other next; C, D are out.
    const r = analyzeGroup([
      P('A', 'C', 1, 0), P('A', 'D', 1, 0), P('B', 'C', 1, 0), P('B', 'D', 1, 0),
      U('A', 'B'), U('C', 'D'),
    ])
    expect(r.clinchedFirst).toBeNull() // A vs B still to play
    expect(sorted(r.clinchedTop2)).toEqual(['A', 'B'])
    expect(sorted(r.eliminatedFromTop2)).toEqual(['C', 'D'])
  })

  it('uses head-to-head (2026 order) for both elimination and clinching', () => {
    // Real Group D shape: USA 6, PAR 3, AUS 3, TUR 0; remaining TUR–USA and PAR–AUS.
    // TUR's ceiling is 3, USA is locked above, and PAR/AUS play each other so one always clears 3.
    // TUR also lost to BOTH PAR and AUS head-to-head, so any tie on points still leaves it below them
    // (2026 applies head-to-head before goal difference) → TUR is certain 4th, out of the tournament.
    // USA can only be tied (not passed) on points, but beat BOTH PAR and AUS head-to-head, so it wins
    // any such tie → USA has clinched 1st, and PAR/AUS can no longer finish 1st.
    const r = analyzeGroup([
      P('USA', 'PAR', 1, 0), P('AUS', 'TUR', 1, 0), P('USA', 'AUS', 1, 0), P('TUR', 'PAR', 0, 1),
      U('TUR', 'USA'), U('PAR', 'AUS'),
    ])
    expect(r.eliminatedFromTop2).toContain('TUR')
    expect(r.eliminatedFromTop3).toContain('TUR') // lost cause
    expect(sorted(r.eliminatedFromFirst)).toEqual(['AUS', 'PAR', 'TUR'])
    expect(r.clinchedFirst).toBe('USA')
    expect(r.clinchedTop2).toEqual(['USA'])
    expect(r.top2OrderLocked).toBeNull() // 2nd place still open between PAR and AUS
    // PAR and AUS can still finish top 2, so neither is a lost cause.
    expect(r.eliminatedFromTop3).not.toContain('PAR')
    expect(r.eliminatedFromTop3).not.toContain('AUS')
  })

  it('on a finished group: locks exact 1st/2nd order', () => {
    const r = analyzeGroup([
      P('A', 'B', 1, 0), P('A', 'C', 1, 0), P('A', 'D', 1, 0),
      P('B', 'C', 1, 0), P('B', 'D', 1, 0), P('C', 'D', 1, 0),
    ]) // A=9, B=6, C=3, D=0
    expect(r.complete).toBe(true)
    expect(r.clinchedFirst).toBe('A')
    expect(r.top2OrderLocked).toEqual(['A', 'B'])
    expect(sorted(r.clinchedTop2)).toEqual(['A', 'B'])
    expect(sorted(r.eliminatedFromTop2)).toEqual(['C', 'D'])
  })
})
