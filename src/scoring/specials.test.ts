import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error - plain JS module, no types
import { resolveSpecials } from '../../scripts/specials.mjs'

const bets = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../public/data/bets.json'), 'utf8'),
)
const specialQuestions = bets.specialQuestions as { id: string; text: string }[]

const base = {
  specialQuestions,
  matches: [] as any[],
  scorerKeys: [] as string[],
  groupWinners: {} as Record<string, string>,
  clinchedTop2: [] as string[],
  eliminatedFromFirst: [] as string[],
  allGroupsComplete: false,
  r32: [] as string[],
  r32Complete: false,
  allMatchesFinished: false,
}
const run = (over: Partial<typeof base>) => resolveSpecials({ ...base, ...over }).answers
const M = (o: any) => ({ stage: 'GROUP', group: 'A', home: 'X', away: 'Y', homeScore: 0, awayScore: 0, finished: true, winner: 'DRAW', decidedIn: 'REGULAR', ...o })

describe('resolveSpecials', () => {
  it('sq1 opener 2+ goals', () => {
    const opener = (h: number, a: number) => M({ home: 'Meksiko', away: 'Etelä-Afrikka', homeScore: h, awayScore: a })
    expect(run({ matches: [opener(2, 0)] }).sq1).toBe('Kyllä')
    expect(run({ matches: [opener(1, 0)] }).sq1).toBe('Ei')
    expect(run({ matches: [{ ...opener(0, 0), finished: false }] }).sq1).toBeUndefined() // not played
  })

  it('sq5 some team scores 5+ (Yes early, No only at the end)', () => {
    expect(run({ matches: [M({ homeScore: 5, awayScore: 1 })] }).sq5).toBe('Kyllä')
    expect(run({ matches: [M({ homeScore: 3, awayScore: 0 })], allMatchesFinished: true }).sq5).toBe('Ei')
    expect(run({ matches: [M({ homeScore: 3, awayScore: 0 })], allMatchesFinished: false }).sq5).toBeUndefined()
  })

  it('sq3 Argentina wins group J', () => {
    expect(run({ groupWinners: { J: 'Argentiina' } }).sq3).toBe('Kyllä')
    expect(run({ groupWinners: { J: 'Espanja' } }).sq3).toBe('Ei')
    expect(run({ groupWinners: {} }).sq3).toBeUndefined()
  })

  it('sq2 >=2 hosts reach R32', () => {
    expect(run({ r32: ['Yhdysvallat', 'Kanada', 'Brasilia'] }).sq2).toBe('Kyllä')
    expect(run({ r32: ['Meksiko', 'Brasilia'], r32Complete: true }).sq2).toBe('Ei')
    expect(run({ r32: ['Meksiko'], r32Complete: false }).sq2).toBeUndefined()
  })

  it('sq6 debutant reaches R32', () => {
    expect(run({ r32: ['Curaçao', 'Brasilia'] }).sq6).toBe('Kyllä')
    expect(run({ r32: ['Brasilia'], r32Complete: true }).sq6).toBe('Ei')
  })

  it('sq7 Ronaldo or Messi scores (open play)', () => {
    expect(run({ scorerKeys: ['lionel messi', 'kai havertz'] }).sq7).toBe('Kyllä')
    expect(run({ scorerKeys: ['cristiano ronaldo'] }).sq7).toBe('Kyllä')
    expect(run({ scorerKeys: ['kai havertz'], allMatchesFinished: true }).sq7).toBe('Ei')
    expect(run({ scorerKeys: ['kai havertz'], allMatchesFinished: false }).sq7).toBeUndefined()
  })

  it('sq8 a non-Europe/S.America team wins its group', () => {
    expect(run({ groupWinners: { A: 'Marokko' } }).sq8).toBe('Kyllä') // CAF
    expect(run({ groupWinners: { A: 'Espanja', B: 'Brasilia' }, allGroupsComplete: true }).sq8).toBe('Ei')
    expect(run({ groupWinners: { A: 'Espanja' }, allGroupsComplete: false }).sq8).toBeUndefined()
  })

  it('sq4 any knockout match to a shootout', () => {
    const ko = (d: string) => M({ stage: 'R16', home: 'Brasilia', away: 'Ranska', decidedIn: d, finished: true })
    expect(run({ matches: [ko('PENALTIES')] }).sq4).toBe('Kyllä')
    expect(run({ matches: [ko('REGULAR')] }).sq4).toBe('Ei') // all KO matches done, no shootout
  })

  it('sq9 final decided in ET or penalties', () => {
    const fin = (d: string) => M({ stage: 'FINAL', home: 'Espanja', away: 'Ranska', decidedIn: d, finished: true })
    expect(run({ matches: [fin('EXTRA_TIME')] }).sq9).toBe('Kyllä')
    expect(run({ matches: [fin('PENALTIES')] }).sq9).toBe('Kyllä')
    expect(run({ matches: [fin('REGULAR')] }).sq9).toBe('Ei')
  })

  // ---- early resolution from clinch signals (before groups finish) ----
  it('sq2 resolves Yes when two hosts have clinched top-2 (before R32 is drawn)', () => {
    expect(run({ clinchedTop2: ['Yhdysvallat', 'Meksiko'] }).sq2).toBe('Kyllä')
    expect(run({ clinchedTop2: ['Yhdysvallat'] }).sq2).toBeUndefined() // only one so far
  })
  it('sq6 resolves Yes when a debutant has clinched top-2', () => {
    expect(run({ clinchedTop2: ['Curaçao'] }).sq6).toBe('Kyllä')
  })
  it('sq3 resolves No early once Argentina can no longer win group J', () => {
    expect(run({ eliminatedFromFirst: ['Argentiina'] }).sq3).toBe('Ei')
    expect(run({ groupWinners: { J: 'Argentiina' } }).sq3).toBe('Kyllä')
  })
})
