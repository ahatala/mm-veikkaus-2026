// Points-based "mathematical certainty" analysis for one group, so positions can resolve before the
// final round is played. Everything here is SOUND (conservative): it only declares something certain
// when points alone guarantee it regardless of remaining results. Cases that hinge on tiebreakers
// (goal difference, head-to-head) are left unresolved until the group finishes, when the actual
// standings (with full tiebreakers) are used instead.
//
// Bounds used: a team's floor = its current points (assume it wins nothing more); a team's ceiling =
// current points + 3 × its remaining matches.

/**
 * @param matches one group's matches: [{home, away, homeScore, awayScore, finished}]
 * @returns { teams, complete, clinchedFirst, top2OrderLocked, clinchedTop2, eliminatedFromFirst, eliminatedFromTop2, pts }
 */
export function analyzeGroup(matches) {
  const teams = [...new Set(matches.flatMap((m) => [m.home, m.away]).filter(Boolean))]
  const n = teams.length
  const totalMatches = (n * (n - 1)) / 2
  const pts = {}, played = {}
  for (const t of teams) { pts[t] = 0; played[t] = 0 }
  let finishedCount = 0
  for (const m of matches) {
    if (!m.finished || m.home == null || m.away == null) continue
    finishedCount++
    played[m.home]++; played[m.away]++
    if (m.homeScore > m.awayScore) pts[m.home] += 3
    else if (m.homeScore < m.awayScore) pts[m.away] += 3
    else { pts[m.home] += 1; pts[m.away] += 1 }
  }
  const minFinal = {}, maxFinal = {}
  for (const t of teams) {
    const remaining = (n - 1) - played[t]
    minFinal[t] = pts[t]
    maxFinal[t] = pts[t] + 3 * remaining
  }
  const others = (x) => teams.filter((t) => t !== x)

  // First place clinched: nobody else can even reach this team's current points.
  let clinchedFirst = null
  for (const a of teams) if (others(a).every((y) => maxFinal[y] < pts[a])) { clinchedFirst = a; break }

  // Can't be 1st: someone is already guaranteed strictly above (their floor > this team's ceiling).
  const eliminatedFromFirst = teams.filter((x) => others(x).some((y) => minFinal[y] > maxFinal[x]))

  // Guaranteed top 2: at most one other team can reach this team's floor (ties count as a threat).
  const clinchedTop2 = teams.filter((x) => others(x).filter((y) => maxFinal[y] >= minFinal[x]).length <= 1)

  // Can't be top 2: at least two teams are guaranteed above.
  const eliminatedFromTop2 = teams.filter((x) => others(x).filter((y) => minFinal[y] > maxFinal[x]).length >= 2)

  // Exact 1st/2nd order locked by points alone: 1st clinched, and exactly one team can reach 2nd.
  let top2OrderLocked = null
  if (clinchedFirst) {
    const second = others(clinchedFirst).filter((b) =>
      teams.filter((y) => y !== clinchedFirst && y !== b).every((y) => maxFinal[y] < pts[b]))
    if (second.length === 1) top2OrderLocked = [clinchedFirst, second[0]]
  }

  return {
    teams,
    complete: totalMatches > 0 && finishedCount === totalMatches,
    clinchedFirst,
    top2OrderLocked,
    clinchedTop2,
    eliminatedFromFirst,
    eliminatedFromTop2,
    pts,
  }
}
