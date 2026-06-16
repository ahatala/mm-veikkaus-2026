import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compute, goldenPointsForGoals, scoreTop2, scoreMatches, scoreLive } from './engine'
import type { Bets, Results, Overrides } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
const loadJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'))

const bets = loadJson(resolve(HERE, '../../public/data/bets.json')) as Bets
// Stable snapshot oracle (the live results.json is overwritten by the fetcher, so we don't use it here).
const results = loadJson(resolve(HERE, '__fixtures__/snapshot.results.json')) as Results
const overrides = loadJson(resolve(HERE, '__fixtures__/snapshot.overrides.json')) as Overrides

// The Google Sheet already computed the standings for the current snapshot. Feeding that same
// snapshot (played group matches + Golden Boot goals + the two resolved special questions) into our
// engine must reproduce the sheet's leaderboard exactly — both totals and tie-broken order.
const EXPECTED_TOTALS: Record<string, number> = {
  Julle: 10, Eikku: 15, Niina: 17, Rasmus: 11, Aaron: 18, Dee: 16, Pasi: 10,
  Jone: 26, Paula: 13, Elmo: 12, Elias: 14, Oliver: 19, Otso: 15, 'Tomi&Kasper': 16,
}
const EXPECTED_ORDER = [
  'Jone', 'Oliver', 'Aaron', 'Niina', 'Tomi&Kasper', 'Dee', 'Otso',
  'Eikku', 'Elias', 'Paula', 'Elmo', 'Rasmus', 'Pasi', 'Julle',
]

describe('scoring engine vs. sheet snapshot', () => {
  const c = compute(bets, results, overrides)
  const byName = Object.fromEntries(c.standings.map((r) => [r.name, r]))

  it('reproduces every participant total', () => {
    const got = Object.fromEntries(c.standings.map((r) => [r.name, r.total]))
    expect(got).toEqual(EXPECTED_TOTALS)
  })

  it('reproduces the ranked order (with the sheet tie-break)', () => {
    expect(c.standings.map((r) => r.name)).toEqual(EXPECTED_ORDER)
    expect(c.standings.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('awards the contrarian bonus correctly', () => {
    const auTr = c.matches.find((m) => m.match.home === 'Australia' && m.match.away === 'Turkki')!
    expect(auTr.actual).toBe('1')
    expect(auTr.bonus).toBe(true) // only Jone picked the winning sign
    expect(auTr.points.Jone).toBe(3)

    const belEgy = c.matches.find((m) => m.match.home === 'Belgia' && m.match.away === 'Egypti')!
    expect(belEgy.actual).toBe('X')
    expect(belEgy.bonus).toBe(true) // Julle + Aaron only
    expect(belEgy.points.Julle).toBe(3)
    expect(belEgy.points.Aaron).toBe(3)

    const meksiko = c.matches.find((m) => m.match.id === 'g1')! // everyone picked 1 -> no bonus
    expect(meksiko.bonus).toBe(false)
    expect(meksiko.points.Jone).toBe(1)
  })

  it('scores the Golden Boot 3-2-1 correctly', () => {
    expect(byName.Jone.breakdown.goldenBoot).toBe(8) // Vinícius (1g=3) + Havertz (2g=5)
    expect(byName['Tomi&Kasper'].breakdown.goldenBoot).toBe(5) // Havertz 2g
    const havertzBackers = c.goldenBoot.byName['Jone'].find((l) => l.player === 'Kai Havertz')!
    expect(havertzBackers).toMatchObject({ goals: 2, points: 5 })
  })

  it('scores resolved special questions only', () => {
    expect(c.special.filter((s) => s.resolved).map((s) => s.question.id).sort()).toEqual(['sq1', 'sq5'])
    expect(byName.Julle.breakdown.specialQuestions).toBe(0) // got both wrong/Ei
    expect(byName.Eikku.breakdown.specialQuestions).toBe(6) // both right
  })

  it('does not award unresolved categories (group stage not finished)', () => {
    for (const r of c.standings) {
      expect(r.breakdown.groupTop2).toBe(0)
      expect(r.breakdown.quarterfinalists).toBe(0)
      expect(r.breakdown.champion).toBe(0)
    }
  })
})

describe('scoreMatches attaches score + goalscorers', () => {
  const b = {
    participants: ['P1', 'P2'],
    groupMatches: [{ id: 'g1', date: 'to 11.6.', group: 'A', time: '22:00', home: 'X', away: 'Y', picks: { P1: '1', P2: '2' } }],
  } as unknown as Bets

  it('exposes the score and scorers for a finished match', () => {
    const [r] = scoreMatches(b, { g1: '1' }, { g1: { homeScore: 2, awayScore: 1, scorers: [{ name: 'Foo', side: 'home', minute: '10' }] } })
    expect(r.score).toEqual({ home: 2, away: 1 })
    expect(r.scorers).toHaveLength(1)
    expect(r.points).toEqual({ P1: 1, P2: 0 })
  })
  it('leaves score null and scorers empty when there is no result', () => {
    const [r] = scoreMatches(b, {}, {})
    expect(r.score).toBeNull()
    expect(r.scorers).toEqual([])
  })
})

describe('scoreLive (provisional "if it ended now")', () => {
  const b = {
    participants: ['P1', 'P2', 'P3'],
    groupMatches: [{ id: 'g1', date: '', group: 'A', time: '', home: 'X', away: 'Y', picks: { P1: '1', P2: 'X', P3: '2' } }],
  } as unknown as Bets

  it('gives provisional points based on the current score', () => {
    const [r] = scoreLive(b, [{ id: 'g1', home: 'X', away: 'Y', group: 'A', homeScore: 1, awayScore: 0, minute: 67, status: 'IN_PLAY' }])
    expect(r.provisionalSign).toBe('1')
    expect(r.minute).toBe(67)
    expect(r.bonus).toBe(false) // 1 of 3 voters is not < 1/3
    expect(r.points).toEqual({ P1: 1, P2: 0, P3: 0 })
  })
  it('returns nothing when no match is live', () => {
    expect(scoreLive(b, [])).toEqual([])
  })
})

describe('scoreTop2 (decided order + early impossibility)', () => {
  const b = {
    participants: ['P1', 'P2'],
    groupTop2: [{ group: 'A', order: ['Espanja', 'Ranska'], label: '1. Espanja, 2. Ranska', picks: { P1: 'Kyllä', P2: 'Ei' } }],
  } as unknown as Bets

  it('awards Kyllä-backers when the decided order matches', () => {
    const [r] = scoreTop2(b, { A: ['Espanja', 'Ranska'] })
    expect(r.resolved).toBe(true)
    expect(r.points).toEqual({ P1: 2, P2: 0 })
  })
  it('awards Ei-backers when the decided order differs', () => {
    const [r] = scoreTop2(b, { A: ['Ranska', 'Espanja'] })
    expect(r.points).toEqual({ P1: 0, P2: 2 })
  })
  it('resolves Ei early when the predicted winner can no longer win', () => {
    const [r] = scoreTop2(b, {}, { A: { eliminatedFromFirst: ['Espanja'], eliminatedFromTop2: [] } })
    expect(r.resolved).toBe(true)
    expect(r.correctAnswer).toBe('Ei')
    expect(r.points).toEqual({ P1: 0, P2: 2 })
  })
  it('stays unresolved with no decided order and no elimination', () => {
    const [r] = scoreTop2(b, {}, {})
    expect(r.resolved).toBe(false)
    expect(r.points).toEqual({ P1: 0, P2: 0 })
  })
})

describe('goldenPointsForGoals', () => {
  const s = { firstGoal: 3, secondGoal: 2, subsequent: 1 }
  it('maps goals to points', () => {
    expect([0, 1, 2, 3, 4, 5].map((g) => goldenPointsForGoals(g, s))).toEqual([0, 3, 5, 6, 7, 8])
  })
})
