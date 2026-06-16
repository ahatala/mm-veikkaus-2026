// Ingests the (frozen) bets from the VEIKKAUKSET CSV export into structured JSON.
//
// Inputs:  scripts/source/veikkaukset.csv
// Outputs: public/data/bets.json                — every participant's picks + tournament metadata
//          public/data/maps/teams.json          — Finnish team name -> football-data name (seed)
//          public/data/maps/players.json         — Golden Boot player name -> football-data name (seed)
//          public/data/results.json (initial)    — sheet snapshot of known results (dev seed)
//          public/data/overrides.json (initial)  — resolved special-question answers (dev seed)
//
// The bets are locked (entries closed 3h before the 11.6.2026 opener), so this is a one-time run.
// Re-running is idempotent; it overwrites the bets/maps but does NOT clobber results/overrides if
// they already exist (so a later live results.json / hand-edited overrides.json survive re-ingest).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'scripts/source/veikkaukset.csv')
const OUT = resolve(ROOT, 'public/data')
const FIX = resolve(ROOT, 'src/scoring/__fixtures__') // stable regression oracle (never overwritten by the fetcher)

// --- tiny RFC4180-ish CSV parser (handles quoted fields containing commas) ---
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* ignore */ }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// --- normalization helpers ---
const t = (s) => (s == null ? '' : String(s).trim())
// Diacritic-insensitive, case-insensitive key for matching teams/players across spelling variants.
export const key = (s) =>
  t(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')

// Known team-name fixes in the sheet (typos / variants -> canonical Finnish).
const TEAM_FIX = { 'Argentina': 'Argentiina' }
const normTeam = (s) => {
  const v = t(s)
  return TEAM_FIX[v] || v
}

const normSign = (s) => {
  const v = t(s).toUpperCase()
  return v === '1' || v === 'X' || v === '2' ? v : null
}
const normYesNo = (s) => {
  const v = t(s).toLowerCase()
  if (v.startsWith('kyllä') || v.startsWith('kylla')) return 'Kyllä'
  if (v === 'ei') return 'Ei'
  return null
}

// Canonical 48-team Finnish -> football-data (English) seed map. The English side is best-effort and
// MUST be verified against the live API during the fetch dry-run (team naming varies by provider).
const FIN_TO_EN = {
  Meksiko: 'Mexico', 'Etelä-Afrikka': 'South Africa', 'Etelä-Korea': 'Korea Republic',
  Tšekki: 'Czechia', Kanada: 'Canada', Sveitsi: 'Switzerland', Qatar: 'Qatar',
  'Bosnia-Hertsegovina': 'Bosnia and Herzegovina', Brasilia: 'Brazil', Marokko: 'Morocco',
  Skotlanti: 'Scotland', Haiti: 'Haiti', Yhdysvallat: 'United States', Australia: 'Australia',
  Paraguay: 'Paraguay', Turkki: 'Türkiye', Saksa: 'Germany', Ecuador: 'Ecuador',
  Norsunluurannikko: "Côte d'Ivoire", 'Curaçao': 'Curaçao', Hollanti: 'Netherlands', Japani: 'Japan',
  Tunisia: 'Tunisia', Ruotsi: 'Sweden', Belgia: 'Belgium', Iran: 'IR Iran', Egypti: 'Egypt',
  'Uusi-Seelanti': 'New Zealand', Espanja: 'Spain', Uruguay: 'Uruguay', 'Saudi-Arabia': 'Saudi Arabia',
  'Kap Verde': 'Cape Verde', Ranska: 'France', Senegal: 'Senegal', Norja: 'Norway', Irak: 'Iraq',
  Argentiina: 'Argentina', Itävalta: 'Austria', Algeria: 'Algeria', Jordania: 'Jordan',
  Portugali: 'Portugal', Kolumbia: 'Colombia', Uzbekistan: 'Uzbekistan', 'Kongon DR': 'DR Congo',
  Englanti: 'England', Kroatia: 'Croatia', Ghana: 'Ghana', Panama: 'Panama',
}

// --- known goal tallies + resolved special questions from the sheet snapshot (MAALIT + col C) ---
// MAALIT tab as of the snapshot (only filled players). Used to seed dev results.json and the test.
const SNAPSHOT_GOALS = { 'Kai Havertz': 2, 'Vinícius Júnior': 1, 'Breel Embolo': 1 }

// --- parse ---
const rows = parseCsv(readFileSync(SRC, 'utf8'))
const col0 = (r) => t(rows[r]?.[0])
const findRow = (pred) => rows.findIndex((_, i) => pred(col0(i), i))
const startsWith = (s) => (c) => c.startsWith(s)

const iNames = findRow((c) => c === 'NIMI →')
if (iNames < 0) throw new Error('Could not find NIMI → row')
// Names are contiguous starting at column D (index 3) until the first blank.
const participants = []
for (let j = 3; j < rows[iNames].length; j++) {
  const name = t(rows[iNames][j])
  if (!name) break
  participants.push(name)
}
const COL0 = 3 // first participant column
const pickAt = (r, j) => rows[r]?.[COL0 + j]

const iAlku = findRow(startsWith('ALKULOHKO'))
const iTop2 = findRow(startsWith('LOHKON TOP 2'))
const iTop8 = findRow(startsWith('TOP 8'))
const iTop4 = findRow(startsWith('TOP 4'))
const iFinal = findRow(startsWith('FINALISTIT'))
const iMestari = findRow(startsWith('MESTARI'))
const iKulta = findRow(startsWith('KULTAKENKÄ'))
const iErikois = findRow(startsWith('ERIKOISKYSYMYKSET'))
for (const [n, i] of Object.entries({ iAlku, iTop2, iTop8, iTop4, iFinal, iMestari, iKulta, iErikois }))
  if (i < 0) throw new Error(`Could not find section marker for ${n}`)

const picksByName = (r) => {
  const o = {}
  participants.forEach((name, j) => { o[name] = t(pickAt(r, j)) })
  return o
}

// Group matches (1/X/2)
const matchRe = /^([A-L])\s+(\d{1,2}:\d{2})\s+(.+?)\s+–\s+(.+)$/
const groupMatches = []
const snapshotMatchSigns = {}
for (let r = iAlku + 1; r < iTop2; r++) {
  const b = t(rows[r]?.[1])
  const m = b.match(matchRe)
  if (!m) continue
  const id = `g${groupMatches.length + 1}`
  const picks = {}
  participants.forEach((name, j) => { picks[name] = normSign(pickAt(r, j)) })
  groupMatches.push({
    id, date: t(rows[r][0]), group: m[1], time: m[2],
    home: normTeam(m[3]), away: normTeam(m[4]), picks,
  })
  const actual = normSign(rows[r][2])
  if (actual) snapshotMatchSigns[id] = actual
}

// Group Top 2 (Kyllä/Ei on a stated exact order)
const groupTop2 = []
for (let r = iTop2 + 1; r < iTop8; r++) {
  const label0 = t(rows[r]?.[0])
  if (!/-lohko/i.test(label0)) continue
  const group = label0.match(/^([A-L])/)?.[1] ?? label0
  const order = t(rows[r][1]).split(',').map((s) => normTeam(s.replace(/^\s*\d+\.\s*/, '')))
  const picks = {}
  participants.forEach((name, j) => { picks[name] = normYesNo(pickAt(r, j)) })
  groupTop2.push({ group, order, label: t(rows[r][1]), picks })
}

// Knockout sections: each row is one slot; transpose to per-participant arrays (deduped).
function collectTeams(from, to) {
  const acc = {}
  participants.forEach((name) => { acc[name] = [] })
  for (let r = from; r < to; r++) {
    if (!t(rows[r]?.[1])) continue
    participants.forEach((name, j) => {
      const team = normTeam(pickAt(r, j))
      if (team && !acc[name].includes(team)) acc[name].push(team)
    })
  }
  return acc
}
const quarterfinalists = collectTeams(iTop8 + 1, iTop4)
const semifinalists = collectTeams(iTop4 + 1, iFinal)
const finalists = collectTeams(iFinal + 1, iMestari)

// Champion: single team per participant
const champion = {}
for (let r = iMestari + 1; r < iKulta; r++) {
  if (!t(rows[r]?.[1])) continue
  participants.forEach((name, j) => { champion[name] = normTeam(pickAt(r, j)) })
}

// Golden Boot: 5 player picks per participant
const goldenPicks = {}
participants.forEach((name) => { goldenPicks[name] = [] })
for (let r = iKulta + 1; r < iErikois; r++) {
  if (!t(rows[r]?.[1])) continue
  participants.forEach((name, j) => {
    const p = t(pickAt(r, j))
    if (p) goldenPicks[name].push(p)
  })
}

// Special questions (Kyllä/Ei) — capture resolved actual answers (col C) for the snapshot.
const specialQuestions = []
const snapshotSpecialAnswers = {}
for (let r = iErikois + 1; r < rows.length; r++) {
  const text = t(rows[r]?.[1])
  if (!text) continue
  const id = `sq${specialQuestions.length + 1}`
  const picks = {}
  participants.forEach((name, j) => { picks[name] = normYesNo(pickAt(r, j)) })
  specialQuestions.push({ id, text, points: 3, picks })
  const actual = normYesNo(rows[r][2])
  if (actual) snapshotSpecialAnswers[id] = actual
}

// --- validate expected shape ---
function assertCount(label, got, want) {
  if (got !== want) throw new Error(`Expected ${want} ${label}, got ${got}`)
}
assertCount('participants', participants.length, 14)
assertCount('group matches', groupMatches.length, 72)
assertCount('group top-2', groupTop2.length, 12)
assertCount('special questions', specialQuestions.length, 9)
for (const name of participants) {
  assertCount(`QF picks for ${name}`, quarterfinalists[name].length, 8)
  assertCount(`SF picks for ${name}`, semifinalists[name].length, 4)
  assertCount(`finalist picks for ${name}`, finalists[name].length, 2)
  assertCount(`golden picks for ${name}`, goldenPicks[name].length, 5)
  if (!champion[name]) throw new Error(`Missing champion pick for ${name}`)
}

// --- build outputs ---
const bets = {
  meta: { title: 'J&E-Veikkaus MM-Futis 2026', participantCount: participants.length, source: 'VEIKKAUKSET' },
  participants,
  groupMatches,
  groupTop2,
  knockout: {
    quarterfinalists: { slots: 8, pointsPerTeam: 5, picks: quarterfinalists },
    semifinalists: { slots: 4, pointsPerTeam: 6, picks: semifinalists },
    finalists: { slots: 2, pointsPerTeam: 8, picks: finalists },
    champion: { pointsPerTeam: 12, picks: champion },
  },
  goldenBoot: {
    picksPerPlayer: 5,
    scoring: { firstGoal: 3, secondGoal: 2, subsequent: 1 },
    banned: ['Mbappé', 'Kane', 'Haaland'],
    picks: goldenPicks,
  },
  specialQuestions,
}

// Teams seed: every distinct team referenced anywhere, mapped to football-data name.
const allTeams = new Set()
for (const m of groupMatches) { allTeams.add(m.home); allTeams.add(m.away) }
for (const g of groupTop2) g.order.forEach((x) => allTeams.add(x))
for (const acc of [quarterfinalists, semifinalists, finalists]) for (const arr of Object.values(acc)) arr.forEach((x) => allTeams.add(x))
Object.values(champion).forEach((x) => allTeams.add(x))
const teamsMap = {}
for (const fin of [...allTeams].sort((a, b) => a.localeCompare(b, 'fi'))) {
  teamsMap[fin] = FIN_TO_EN[fin] ?? ''
}

// Players seed: distinct golden-boot picks, mapped to football-data name (filled during fetch build).
const allPlayers = new Set()
for (const arr of Object.values(goldenPicks)) arr.forEach((p) => allPlayers.add(p))
const playersMap = {}
for (const p of [...allPlayers].sort((a, b) => a.localeCompare(b, 'fi'))) playersMap[p] = ''

// Snapshot results.json (dev seed): only what the sheet currently knows.
const snapshotResults = {
  lastUpdated: null,
  source: 'sheet-snapshot',
  groupMatches: snapshotMatchSigns,                 // { matchId: '1'|'X'|'2' } for played matches
  groupStandings: {},                               // group stage not finished yet
  knockout: { quarterfinalists: [], semifinalists: [], finalists: [], champion: null },
  goldenBootGoals: Object.fromEntries(Object.entries(SNAPSHOT_GOALS).map(([n, g]) => [key(n), g])),
  specialAnswers: snapshotSpecialAnswers,           // auto-resolved at snapshot time (sq1, sq5)
}

// Overrides.json (dev seed): empty — special questions are auto-resolved into results.json now;
// the jury uses this file only to override/correct.
const overrides = {
  specialAnswers: {},                               // jury overrides (win over auto-resolved answers)
  corrections: {},                                  // future jury corrections
}

// --- write ---
function writeJson(dir, rel, obj, { keepIfExists = false } = {}) {
  const p = resolve(dir, rel)
  if (keepIfExists && existsSync(p)) { console.log(`kept   ${rel} (already exists)`); return }
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n')
  console.log(`wrote  ${rel}`)
}
writeJson(OUT, 'bets.json', bets)
writeJson(OUT, 'maps/teams.json', teamsMap)
writeJson(OUT, 'maps/players.json', playersMap)
// Seed the live app data (the fetcher overwrites results.json later; overrides survives re-ingest).
writeJson(OUT, 'results.json', snapshotResults, { keepIfExists: true })
writeJson(OUT, 'overrides.json', overrides, { keepIfExists: true })
// Stable snapshot fixtures for the regression test — always regenerated, never touched by the fetcher.
writeJson(FIX, 'snapshot.results.json', snapshotResults)
writeJson(FIX, 'snapshot.overrides.json', overrides)

console.log(`\nOK: ${participants.length} participants, ${groupMatches.length} matches, ${groupTop2.length} groups, ${specialQuestions.length} special questions, ${allTeams.size} teams, ${allPlayers.size} players.`)
