// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import App from './App.vue'
import { loadData, stopAutoRefresh } from './store'

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data')
const bets = JSON.parse(readFileSync(resolve(DATA, 'bets.json'), 'utf8'))
const overrides = { specialAnswers: {}, corrections: {} }
const m = bets.groupMatches[0]

const base = {
  lastUpdated: '2026-06-18T00:00:00Z', source: 'test',
  groupMatches: {} as Record<string, string>, matchResults: {} as Record<string, unknown>,
  live: [] as unknown[], groupStandings: {}, groupTop2: {}, groupClinch: {},
  knockout: { quarterfinalists: [], semifinalists: [], finalists: [], champion: null },
  goldenBootGoals: {}, specialAnswers: {},
}
const liveResults = { ...base, live: [{ id: m.id, home: m.home, away: m.away, group: m.group, homeScore: 1, awayScore: 0, minute: null, status: 'IN_PLAY' }] }
const finishedResults = { ...base, lastUpdated: '2026-06-18T01:00:00Z', groupMatches: { [m.id]: '1' }, matchResults: { [m.id]: { homeScore: 1, awayScore: 0, scorers: [] } } }

let state = { results: liveResults as unknown }
beforeEach(() => {
  state = { results: liveResults }
  vi.stubGlobal('fetch', async (url: string) => {
    const path = new URL(url, 'http://x/').pathname.replace(/^\/+/, '').replace(/^data\//, '')
    const body = path === 'bets.json' ? bets : path === 'overrides.json' ? overrides : state.results
    return { ok: true, status: 200, json: async () => body }
  })
})
afterEach(stopAutoRefresh)

describe('open page reflects live → finished on a silent refresh (no reload)', () => {
  it('drops the live indicator and shows the result without remounting', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.findAll('.tabs button').find((b) => b.text() === 'Ottelut')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('LIVE') // the in-play match shows live

    // The match ends; the backend data updates; the 90s poll fetches it.
    state.results = finishedResults
    await loadData(true)
    await flushPromises()
    expect(wrapper.text()).not.toContain('LIVE') // updated in place, no reload
  })
})
