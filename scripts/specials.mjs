// Pure auto-resolution of the 9 special questions from match/standings/scorer data.
// No side effects or network — imported by scripts/fetch-results.mjs and unit-tested.
//
// Rule of thumb: a "will X happen" question resolves to 'Kyllä' the moment X occurs, and to 'Ei'
// only once the deciding phase is fully played. Unresolved questions are simply omitted (the jury
// can still set/override any answer in overrides.json, which wins over these).

export const HOSTS = ['Yhdysvallat', 'Kanada', 'Meksiko']
export const DEBUTANTS = ['Curaçao', 'Kap Verde', 'Uzbekistan', 'Jordania']

// UEFA + CONMEBOL = the "Europe or South America" teams (canonical Finnish names).
export const EURO_SA = new Set([
  'Tšekki', 'Sveitsi', 'Bosnia-Hertsegovina', 'Skotlanti', 'Turkki', 'Saksa', 'Hollanti', 'Ruotsi',
  'Belgia', 'Espanja', 'Ranska', 'Norja', 'Itävalta', 'Portugali', 'Englanti', 'Kroatia', // UEFA
  'Brasilia', 'Paraguay', 'Ecuador', 'Uruguay', 'Argentiina', 'Kolumbia', // CONMEBOL
])

const KO_STAGES = new Set(['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'])

/**
 * @param ctx {
 *   specialQuestions: [{id, text}],
 *   matches: [{stage, group, home, away, homeScore, awayScore, finished, winner, decidedIn}],
 *   scorerKeys: string[],            // normalized keys of players with >=1 (open-play) goal
 *   groupWinners: { [group]: finnishName },  // only for groups that are fully played
 *   allGroupsComplete: boolean,
 *   r32: string[],                   // Finnish names of the 32 Round-of-32 teams (once drawn)
 *   r32Complete: boolean,            // all 32 known
 *   allMatchesFinished: boolean,
 * }
 * @returns { [sqId]: 'Kyllä' | 'Ei' } for the questions that can be confidently resolved.
 */
export function resolveSpecials(ctx) {
  const {
    specialQuestions, matches, scorerKeys, groupWinners, allGroupsComplete, r32, r32Complete,
    allMatchesFinished, clinchedTop2 = [], eliminatedFromFirst = [],
  } = ctx
  const out = {}
  const has = (id, kw) => (specialQuestions.find((q) => q.id === id)?.text ?? '').toLowerCase().includes(kw)

  const finished = matches.filter((m) => m.finished)
  const r32set = new Set(r32)
  // Teams guaranteed into the knockouts: already drawn into the R32, OR mathematically certain top-2.
  const intoKnockouts = new Set([...r32, ...clinchedTop2])
  const koReal = matches.filter((m) => KO_STAGES.has(m.stage) && m.home && m.away)
  const finalMatch = matches.find((m) => m.stage === 'FINAL')

  // sq1 — opener (Mexico–South Africa) 2+ goals
  if (has('sq1', 'avausottelu')) {
    const op = matches.find((m) => m.home === 'Meksiko' && m.away === 'Etelä-Afrikka')
    if (op?.finished) out.sq1 = op.homeScore + op.awayScore >= 2 ? 'Kyllä' : 'Ei'
  }

  // sq2 — at least two hosts (USA/CAN/MEX) reach the knockouts
  if (has('sq2', 'isäntäma')) {
    if (HOSTS.filter((h) => intoKnockouts.has(h)).length >= 2) out.sq2 = 'Kyllä'
    else if (r32Complete) out.sq2 = HOSTS.filter((h) => r32set.has(h)).length >= 2 ? 'Kyllä' : 'Ei'
  }

  // sq3 — defending champion Argentina wins group J
  if (has('sq3', 'argentiina') || has('sq3', 'lohko j')) {
    if (groupWinners['J']) out.sq3 = groupWinners['J'] === 'Argentiina' ? 'Kyllä' : 'Ei'
    else if (eliminatedFromFirst.includes('Argentiina')) out.sq3 = 'Ei' // can no longer win the group
  }

  // sq4 — any knockout match decided on penalties (note: sq9 also mentions penalties, so exclude the final-only one)
  if (has('sq4', 'rangaistuspotku') && !has('sq4', 'finaali') && !has('sq4', 'mestaruus')) {
    if (koReal.some((m) => m.finished && m.decidedIn === 'PENALTIES')) out.sq4 = 'Kyllä'
    else if (koReal.length > 0 && koReal.every((m) => m.finished)) out.sq4 = 'Ei'
  }

  // sq5 — some team scores 5+ in a single match
  if (has('sq5', 'maalia yhdess') || has('sq5', '5+')) {
    if (finished.some((m) => m.homeScore >= 5 || m.awayScore >= 5)) out.sq5 = 'Kyllä'
    else if (allMatchesFinished) out.sq5 = 'Ei'
  }

  // sq6 — any World Cup debutant reaches the knockouts
  if (has('sq6', 'debytantti')) {
    if (DEBUTANTS.some((d) => intoKnockouts.has(d))) out.sq6 = 'Kyllä'
    else if (r32Complete) out.sq6 = DEBUTANTS.some((d) => r32set.has(d)) ? 'Kyllä' : 'Ei'
  }

  // sq7 — Ronaldo or Messi scores (open play only; shootout goals aren't in the scorer feed)
  if (has('sq7', 'ronaldo') || has('sq7', 'messi')) {
    if (scorerKeys.some((k) => k.includes('messi') || k.includes('ronaldo'))) out.sq7 = 'Kyllä'
    else if (allMatchesFinished) out.sq7 = 'Ei'
  }

  // sq8 — a team from outside Europe/South America wins its group
  if (has('sq8', 'muu kuin euroopan')) {
    const winners = Object.values(groupWinners)
    if (winners.some((w) => !EURO_SA.has(w))) out.sq8 = 'Kyllä'
    else if (allGroupsComplete) out.sq8 = 'Ei'
  }

  // sq9 — the final is decided in extra time or on penalties
  if (has('sq9', 'finaali') || has('sq9', 'mestaruus')) {
    if (finalMatch?.finished) out.sq9 = finalMatch.decidedIn !== 'REGULAR' ? 'Kyllä' : 'Ei'
  }

  return out
}
