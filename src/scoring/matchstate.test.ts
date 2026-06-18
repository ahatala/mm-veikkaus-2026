import { describe, it, expect } from 'vitest'
// @ts-expect-error - plain JS module, no types
import { isStaleLive, isLiveNow } from '../../scripts/matchstate.mjs'

const now = Date.parse('2026-06-18T12:00:00Z')
const recent = '2026-06-18T11:00:00Z' // kicked off 1h ago — genuinely in play
const old = '2026-06-18T02:00:00Z' // kicked off 10h ago — football-data stuck

describe('matchstate (guard against a stuck football-data status)', () => {
  it('isStaleLive: in-play long past kickoff is stale', () => {
    expect(isStaleLive({ status: 'IN_PLAY', utcDate: old }, now)).toBe(true)
    expect(isStaleLive({ status: 'PAUSED', utcDate: old }, now)).toBe(true)
    expect(isStaleLive({ status: 'IN_PLAY', utcDate: recent }, now)).toBe(false)
    expect(isStaleLive({ status: 'FINISHED', utcDate: old }, now)).toBe(false)
    expect(isStaleLive({ status: 'IN_PLAY', utcDate: null }, now)).toBe(false)
  })
  it('isLiveNow: live only when in-play within the window', () => {
    expect(isLiveNow({ status: 'IN_PLAY', utcDate: recent }, now)).toBe(true)
    expect(isLiveNow({ status: 'IN_PLAY', utcDate: old }, now)).toBe(false) // stale -> not live
    expect(isLiveNow({ status: 'FINISHED', utcDate: recent }, now)).toBe(false)
  })
})
