// Pure auto-resolution of the 9 special questions from match/standings/scorer data.
// No side effects or network — imported by scripts/fetch-results.mjs and unit-tested.
//
// Rule of thumb: a "will X happen" question resolves to 'Kyllä' the moment X occurs, and to 'Ei'
// only once the deciding phase is fully played. Unresolved questions are simply omitted (the jury
// can still set/override any answer in overrides.json, which wins over these).
//
// Returns { answers: { [sqId]: 'Kyllä'|'Ei' }, reasons: { [sqId]: string } } — `reasons` is a short
// human-readable justification (the team/match/scorer that decided it), shown in the UI.

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
 *   groupWinners: { [group]: finnishName },  // decided winners (clinched early or final)
 *   allGroupsComplete: boolean,
 *   r32: string[],                   // Finnish names of the 32 Round-of-32 teams (once drawn)
 *   r32Complete: boolean,            // all 32 known
 *   allMatchesFinished: boolean,
 * }
 * @returns { answers: { [sqId]: 'Kyllä'|'Ei' }, reasons: { [sqId]: string } }
 */
export function resolveSpecials(ctx) {
  const {
    specialQuestions, matches, scorerKeys, groupWinners, allGroupsComplete, r32, r32Complete,
    allMatchesFinished, clinchedTop2 = [], eliminatedFromFirst = [],
  } = ctx
  const answers = {}
  const reasons = {}
  const set = (id, answer, reason) => { answers[id] = answer; reasons[id] = reason }
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
    if (op?.finished) {
      const total = op.homeScore + op.awayScore
      set('sq1', total >= 2 ? 'Kyllä' : 'Ei', `Avausottelu Meksiko–Etelä-Afrikka ${op.homeScore}–${op.awayScore} (${total} maalia)`)
    }
  }

  // sq2 — at least two hosts (USA/CAN/MEX) reach the knockouts
  if (has('sq2', 'isäntäma')) {
    const sure = HOSTS.filter((h) => intoKnockouts.has(h))
    if (sure.length >= 2) set('sq2', 'Kyllä', `Jatkoon: ${sure.join(', ')}`)
    else if (r32Complete) {
      const inR32 = HOSTS.filter((h) => r32set.has(h))
      set('sq2', inR32.length >= 2 ? 'Kyllä' : 'Ei',
        inR32.length ? `Jatkoon vain: ${inR32.join(', ')}` : 'Yksikään isäntämaa ei selvinnyt jatkoon')
    }
  }

  // sq3 — defending champion Argentina wins group J
  if (has('sq3', 'argentiina') || has('sq3', 'lohko j')) {
    if (groupWinners['J']) {
      set('sq3', groupWinners['J'] === 'Argentiina' ? 'Kyllä' : 'Ei',
        groupWinners['J'] === 'Argentiina' ? 'Argentiina voitti lohkon J' : `Lohkon J voitti ${groupWinners['J']}`)
    } else if (eliminatedFromFirst.includes('Argentiina')) {
      set('sq3', 'Ei', 'Argentiina ei voi enää voittaa lohkoa J')
    }
  }

  // sq4 — any knockout match decided on penalties (sq9 also mentions penalties → exclude the final-only one)
  if (has('sq4', 'rangaistuspotku') && !has('sq4', 'finaali') && !has('sq4', 'mestaruus')) {
    const pen = koReal.find((m) => m.finished && m.decidedIn === 'PENALTIES')
    if (pen) set('sq4', 'Kyllä', `${pen.home}–${pen.away} ratkesi rangaistuspotkukilpailulla`)
    else if (koReal.length > 0 && koReal.every((m) => m.finished)) set('sq4', 'Ei', 'Yksikään pudotuspeliottelu ei mennyt rangaistuspotkukilpailuun')
  }

  // sq5 — some team scores 5+ in a single match
  if (has('sq5', 'maalia yhdess') || has('sq5', '5+')) {
    const big = finished.find((m) => m.homeScore >= 5 || m.awayScore >= 5)
    if (big) set('sq5', 'Kyllä', `${big.home}–${big.away} ${big.homeScore}–${big.awayScore}`)
    else if (allMatchesFinished) set('sq5', 'Ei', 'Yksikään joukkue ei tehnyt viittä maalia yhdessä ottelussa')
  }

  // sq6 — any World Cup debutant reaches the knockouts
  if (has('sq6', 'debytantti')) {
    const sure = DEBUTANTS.filter((d) => intoKnockouts.has(d))
    if (sure.length) set('sq6', 'Kyllä', `Jatkoon: ${sure.join(', ')}`)
    else if (r32Complete) {
      const inR32 = DEBUTANTS.filter((d) => r32set.has(d))
      set('sq6', inR32.length ? 'Kyllä' : 'Ei',
        inR32.length ? `Jatkoon: ${inR32.join(', ')}` : 'Yksikään debytantti ei selvinnyt jatkoon')
    }
  }

  // sq7 — Ronaldo or Messi scores (open play only; shootout goals aren't in the scorer feed)
  if (has('sq7', 'ronaldo') || has('sq7', 'messi')) {
    const who = []
    if (scorerKeys.some((k) => k.includes('messi'))) who.push('Messi')
    if (scorerKeys.some((k) => k.includes('ronaldo'))) who.push('Ronaldo')
    if (who.length) set('sq7', 'Kyllä', `${who.join(' ja ')} teki maalin`)
    else if (allMatchesFinished) set('sq7', 'Ei', 'Messi eikä Ronaldo tehnyt maalia avoimessa pelissä')
  }

  // sq8 — a team from outside Europe/South America wins its group
  if (has('sq8', 'muu kuin euroopan')) {
    const outside = Object.entries(groupWinners)
      .filter(([, w]) => !EURO_SA.has(w))
      .map(([g, w]) => `${w} (lohko ${g})`)
    if (outside.length) set('sq8', 'Kyllä', `Lohkovoittaja Euroopan/Etelä-Amerikan ulkopuolelta: ${outside.join(', ')}`)
    else if (allGroupsComplete) set('sq8', 'Ei', 'Kaikki lohkovoittajat Euroopasta tai Etelä-Amerikasta')
  }

  // sq9 — the final is decided in extra time or on penalties
  if (has('sq9', 'finaali') || has('sq9', 'mestaruus')) {
    if (finalMatch?.finished) {
      const word = finalMatch.decidedIn === 'PENALTIES' ? 'rangaistuspotkukilpailulla'
        : finalMatch.decidedIn === 'EXTRA_TIME' ? 'jatkoajalla' : 'varsinaisella peliajalla'
      set('sq9', finalMatch.decidedIn !== 'REGULAR' ? 'Kyllä' : 'Ei', `Finaali ratkesi ${word}`)
    }
  }

  return { answers, reasons }
}
