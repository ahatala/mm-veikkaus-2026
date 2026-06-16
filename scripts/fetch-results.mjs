// Fetches live match results and writes public/data/results.json (consumed by the SPA's scoring
// engine). Runs server-side in the GitHub Action — no browser, no CORS, token kept as a repo secret.
//
// Sources:
//   - football-data.org (PRIMARY, live)  — used when FOOTBALL_DATA_TOKEN is set.
//   - openfootball/worldcup.json (FALLBACK, ~daily, no key) — used otherwise / to fill goals.
//
// Both are normalized to one intermediate shape, then folded into results.json. overrides.json is
// never touched here (jury answers + corrections live there and are applied by the engine).
//
// Usage:  node scripts/fetch-results.mjs            # picks source by token presence
//         node scripts/fetch-results.mjs --openfootball   # force fallback source

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = resolve(ROOT, 'public/data')
const loadJson = (f) => JSON.parse(readFileSync(resolve(DATA, f), 'utf8'))

const bets = loadJson('bets.json')
const teamsMap = loadJson('maps/teams.json') // Finnish -> football-data English (seed)

// ---------- name matching ----------
const baseKey = (s) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const playerKey = (s) => baseKey(s).replace(/\s+/g, ' ')
const teamKey = (s) => baseKey(s).replace(/[^a-z0-9]/g, '') // punctuation/space-insensitive

// Reverse team lookup tolerant of both providers' spellings. Built from teams.json plus an alias
// table for known divergences (openfootball vs football-data).
const ALIASES = {
  'Etelä-Korea': ['South Korea', 'Korea Republic', 'Korea, South'],
  Tšekki: ['Czech Republic', 'Czechia'],
  'Bosnia-Hertsegovina': ['Bosnia & Herzegovina', 'Bosnia and Herzegovina'],
  Yhdysvallat: ['USA', 'United States', 'United States of America'],
  Turkki: ['Turkey', 'Türkiye', 'Turkiye'],
  Norsunluurannikko: ['Ivory Coast', "Côte d'Ivoire", 'Cote dIvoire'],
  Iran: ['Iran', 'IR Iran'],
  'Kongon DR': ['DR Congo', 'Congo DR', 'Democratic Republic of the Congo'],
  'Kap Verde': ['Cape Verde', 'Cabo Verde'],
}
const finnishByKey = new Map()
for (const [fin, en] of Object.entries(teamsMap)) {
  finnishByKey.set(teamKey(fin), fin)
  if (en) finnishByKey.set(teamKey(en), fin)
}
for (const [fin, aliases] of Object.entries(ALIASES)) for (const a of aliases) finnishByKey.set(teamKey(a), fin)

// Knockout fixtures reference yet-undetermined slots, not teams: "1A"/"2B" (group rank),
// "3A/B/C/D/F" (best-third combos), "W74"/"L101" (winner/loser of match N). Ignore those silently.
const isPlaceholder = (name) => /^\d/.test(name ?? '') || /^[WL]\d/.test(name ?? '')
const unmatchedTeams = new Set()
const toFinnish = (name) => {
  if (!name || isPlaceholder(name)) return null
  const f = finnishByKey.get(teamKey(name))
  if (!f) unmatchedTeams.add(name)
  return f ?? null
}

// ---------- intermediate shape ----------
// { matches: [{stage, group, home, away, homeScore, awayScore, finished}], standings: {A:[fin...]}|null,
//   scorers: { playerKey: goals } }

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`)
  return res.json()
}

const FD_STAGE = {
  GROUP_STAGE: 'GROUP', LAST_32: 'R32', LAST_16: 'R16',
  QUARTER_FINALS: 'QF', SEMI_FINALS: 'SF', THIRD_PLACE: '3RD', FINAL: 'FINAL',
}

async function fromFootballData(token) {
  const headers = { 'X-Auth-Token': token }
  const base = 'https://api.football-data.org/v4/competitions/WC'
  const [matchesRes, standingsRes, scorersRes] = await Promise.all([
    fetchJson(`${base}/matches`, headers),
    fetchJson(`${base}/standings`, headers).catch((e) => { console.warn('standings:', e.message); return { standings: [] } }),
    fetchJson(`${base}/scorers?limit=100`, headers).catch((e) => { console.warn('scorers:', e.message); return { scorers: [] } }),
  ])
  const matches = (matchesRes.matches ?? []).map((m) => ({
    stage: FD_STAGE[m.stage] ?? m.stage,
    group: m.group ? m.group.replace(/^GROUP_/, '') : null,
    home: toFinnish(m.homeTeam?.name),
    away: toFinnish(m.awayTeam?.name),
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    finished: m.status === 'FINISHED',
  }))
  const standings = {}
  for (const s of standingsRes.standings ?? []) {
    if (s.type && s.type !== 'TOTAL') continue
    const g = (s.group ?? '').replace(/^GROUP_/, '')
    if (!g) continue
    standings[g] = (s.table ?? []).map((row) => toFinnish(row.team?.name)).filter(Boolean)
  }
  const scorers = {}
  for (const s of scorersRes.scorers ?? []) {
    const g = s.goals ?? s.numberOfGoals ?? 0
    if (s.player?.name) scorers[playerKey(s.player.name)] = g
  }
  return { matches, standings: Object.keys(standings).length ? standings : null, scorers, _scorerCount: (scorersRes.scorers ?? []).length }
}

const OF_STAGE = [
  [/third/i, '3RD'], [/final/i, 'FINAL'], [/semi/i, 'SF'], [/quarter/i, 'QF'],
  [/round of 16|last 16/i, 'R16'], [/round of 32|last 32/i, 'R32'],
]
const ofStage = (s) => {
  for (const [re, v] of OF_STAGE) if (re.test(s)) return v
  return 'GROUP'
}

async function fromOpenfootball() {
  const url = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
  const data = await fetchJson(url, {})
  const scorers = {}
  const matches = (data.matches ?? []).map((m) => {
    const ft = m.score?.ft
    const finished = Array.isArray(ft) && ft.length === 2
    for (const g of [...(m.goals1 ?? []), ...(m.goals2 ?? [])]) {
      if (g.owngoal) continue // own goals don't count for the scorer; shootout goals aren't listed here
      const k = playerKey(g.name)
      scorers[k] = (scorers[k] ?? 0) + 1
    }
    const stageStr = `${m.group ?? ''} ${m.round ?? ''}`
    return {
      stage: ofStage(stageStr),
      group: /^Group ([A-L])/.exec(m.group ?? '')?.[1] ?? null,
      home: toFinnish(m.team1),
      away: toFinnish(m.team2),
      homeScore: finished ? ft[0] : null,
      awayScore: finished ? ft[1] : null,
      finished,
    }
  })
  return { matches, standings: null, scorers, _scorerCount: Object.keys(scorers).length }
}

// ---------- derive standings from finished group matches (when a group is complete) ----------
function deriveStandings(matches) {
  const groups = {}
  for (const m of matches) {
    if (m.stage !== 'GROUP' || !m.group || !m.home || !m.away) continue
    ;(groups[m.group] ??= []).push(m)
  }
  const out = {}
  for (const [g, ms] of Object.entries(groups)) {
    if (ms.length < 6 || !ms.every((m) => m.finished)) continue // only when the full group is played
    const tbl = {}
    const row = (t) => (tbl[t] ??= { team: t, pts: 0, gd: 0, gf: 0, h2h: {} })
    for (const m of ms) {
      const h = row(m.home), a = row(m.away)
      h.gf += m.homeScore; a.gf += m.awayScore
      h.gd += m.homeScore - m.awayScore; a.gd += m.awayScore - m.homeScore
      if (m.homeScore > m.awayScore) { h.pts += 3; h.h2h[m.away] = (h.h2h[m.away] ?? 0) + 3 }
      else if (m.homeScore < m.awayScore) { a.pts += 3; a.h2h[m.home] = (a.h2h[m.home] ?? 0) + 3 }
      else { h.pts += 1; a.pts += 1; h.h2h[m.away] = (h.h2h[m.away] ?? 0) + 1; a.h2h[m.home] = (a.h2h[m.home] ?? 0) + 1 }
    }
    out[g] = Object.values(tbl)
      .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || (y.h2h[x.team] ?? 0) - (x.h2h[y.team] ?? 0) || x.team.localeCompare(y.team, 'fi'))
      .map((r) => r.team)
  }
  return out
}

// ---------- fold intermediate into results.json ----------
function build(inter) {
  // group match signs, mapped to bets match ids by team pair
  const byPair = new Map()
  for (const m of bets.groupMatches) byPair.set(`${m.home}|${m.away}`, m.id)
  const groupMatches = {}
  const unmatchedPairs = []
  for (const m of inter.matches) {
    if (m.stage !== 'GROUP' || !m.finished || !m.home || !m.away) continue
    const sign = m.homeScore > m.awayScore ? '1' : m.homeScore < m.awayScore ? '2' : 'X'
    const id = byPair.get(`${m.home}|${m.away}`)
    if (id) groupMatches[id] = sign
    else unmatchedPairs.push(`${m.home}–${m.away}`)
  }

  const teamsInStage = (stage) => {
    const set = []
    for (const m of inter.matches) {
      if (m.stage !== stage) continue
      for (const t of [m.home, m.away]) if (t && !set.includes(t)) set.push(t)
    }
    return set
  }
  const finalMatch = inter.matches.find((m) => m.stage === 'FINAL')
  let champion = null
  if (finalMatch?.finished) {
    champion = finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home
      : finalMatch.homeScore < finalMatch.awayScore ? finalMatch.away : null
  }

  const standings = inter.standings ?? deriveStandings(inter.matches)

  return {
    lastUpdated: new Date().toISOString(),
    source: inter._source,
    groupMatches,
    groupStandings: standings,
    knockout: {
      quarterfinalists: teamsInStage('QF'),
      semifinalists: teamsInStage('SF'),
      finalists: teamsInStage('FINAL'),
      champion,
    },
    goldenBootGoals: inter.scorers,
    _diagnostics: { unmatchedTeams: [...unmatchedTeams], unmatchedPairs, scorerCount: inter._scorerCount },
  }
}

// ---------- main ----------
const forceOf = process.argv.includes('--openfootball')
const token = process.env.FOOTBALL_DATA_TOKEN
let inter
if (token && !forceOf) {
  console.log('Source: football-data.org (live)')
  inter = await fromFootballData(token)
  inter._source = 'football-data.org'
  // Free scorers endpoint can be length-capped; backfill from openfootball if it looks short.
  const pickedKeys = new Set(Object.values(bets.goldenBoot.picks).flat().map(playerKey))
  const haveAll = [...pickedKeys].every((k) => k in inter.scorers)
  if (!haveAll) {
    console.warn('football-data scorers missing some picked players — backfilling from openfootball')
    const of = await fromOpenfootball()
    inter.scorers = { ...of.scorers, ...inter.scorers }
  }
} else {
  console.log('Source: openfootball/worldcup.json (no token)')
  inter = await fromOpenfootball()
  inter._source = 'openfootball'
}

const results = build(inter)
writeFileSync(resolve(DATA, 'results.json'), JSON.stringify(results, null, 2) + '\n')

const d = results._diagnostics
console.log(`wrote results.json — ${Object.keys(results.groupMatches).length} group results, ` +
  `${Object.keys(results.goldenBootGoals).length} scorers, ` +
  `${results.knockout.quarterfinalists.length} QF teams, champion=${results.knockout.champion ?? '—'}`)
if (d.unmatchedTeams.length) console.warn('⚠ unmatched team names:', d.unmatchedTeams.join(', '))
if (d.unmatchedPairs.length) console.warn('⚠ unmatched fixtures:', d.unmatchedPairs.join(', '))
