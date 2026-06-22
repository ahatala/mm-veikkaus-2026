// Mathematical-certainty analysis for one group, using the FIFA World Cup 2026 tiebreak order
// (head-to-head BEFORE overall goal difference). Sound AND tight: it enumerates every combination of
// the remaining results (a 4-team group has at most 6 unplayed matches -> 3^6 = 729 cases) and only
// declares something certain when it holds in *every* case. Because it simulates the actual remaining
// fixtures, it correctly accounts for contenders who still play each other — which per-team min/max
// bounds cannot see.
//
// Within a scenario only win/draw/loss is known (not exact scores), so teams level on points are
// separated only as far as head-to-head POINTS allow; any still level after that form one unresolved
// "tier" (their order would hinge on goal difference, which depends on unknown scores). For each team
// we take its best- and worst-possible rank across those tiers, then aggregate over all scenarios:
//   - canFirst / canTop2 / canTop3 : reachable in SOME scenario (best-case rank)
//   - clinchedFirst / clinchedTop2 : guaranteed in EVERY scenario (worst-case rank)
//   - eliminatedFromX = unreachable in every scenario
// In a 4-team group, a team that can't reach the top 3 is certain to finish last — i.e. out of the
// tournament (4th place never advances).

function applyResult(pts, h2h, home, away, outcome) {
  // outcome: 0 home win, 1 away win, 2 draw
  if (outcome === 0) { pts[home] += 3; h2h[home][away] = (h2h[home][away] ?? 0) + 3 }
  else if (outcome === 1) { pts[away] += 3; h2h[away][home] = (h2h[away][home] ?? 0) + 3 }
  else {
    pts[home] += 1; pts[away] += 1
    h2h[home][away] = (h2h[home][away] ?? 0) + 1
    h2h[away][home] = (h2h[away][home] ?? 0) + 1
  }
}

/** Rank one scenario into tiers (top tier first); teams within a tier are mutually unresolved. */
function rankTiers(teams, pts, h2h) {
  const byPts = [...teams].sort((x, y) => pts[y] - pts[x])
  const tiers = []
  for (let i = 0; i < byPts.length;) {
    let j = i
    while (j < byPts.length && pts[byPts[j]] === pts[byPts[i]]) j++
    const tied = byPts.slice(i, j)
    if (tied.length === 1) {
      tiers.push(tied)
    } else {
      // Split the points-tie by head-to-head points among exactly these teams (2026: applied before
      // overall goal difference). Teams still equal on h2h points stay in one unresolved tier.
      const hp = {}
      for (const x of tied) { let s = 0; for (const y of tied) if (y !== x) s += h2h[x]?.[y] ?? 0; hp[x] = s }
      const sub = [...tied].sort((x, y) => hp[y] - hp[x])
      for (let a = 0; a < sub.length;) {
        let b = a
        while (b < sub.length && hp[sub[b]] === hp[sub[a]]) b++
        tiers.push(sub.slice(a, b))
        a = b
      }
    }
    i = j
  }
  return tiers
}

/**
 * @param matches one group's matches: [{home, away, homeScore, awayScore, finished}]
 * @returns { teams, complete, clinchedFirst, top2OrderLocked, clinchedTop2,
 *            eliminatedFromFirst, eliminatedFromTop2, eliminatedFromTop3, pts }
 */
export function analyzeGroup(matches) {
  const teams = [...new Set(matches.flatMap((m) => [m.home, m.away]).filter(Boolean))]
  const n = teams.length
  const totalMatches = (n * (n - 1)) / 2

  const basePts = {}, baseH2h = {}
  for (const t of teams) { basePts[t] = 0; baseH2h[t] = {} }
  let finishedCount = 0
  const remaining = [] // unplayed fixtures, as [home, away]
  for (const m of matches) {
    if (m.home == null || m.away == null) continue
    if (m.finished) {
      finishedCount++
      applyResult(basePts, baseH2h, m.home, m.away, m.homeScore > m.awayScore ? 0 : m.homeScore < m.awayScore ? 1 : 2)
    } else {
      remaining.push([m.home, m.away])
    }
  }

  const canFirst = {}, canTop2 = {}, canTop3 = {}, mustFirst = {}, mustTop2 = {}, mustSecond = {}
  for (const t of teams) {
    canFirst[t] = canTop2[t] = canTop3[t] = false
    mustFirst[t] = mustTop2[t] = mustSecond[t] = true
  }

  const k = remaining.length
  const scenarios = 3 ** k
  for (let code = 0; code < scenarios; code++) {
    const pts = { ...basePts }
    const h2h = {}
    for (const t of teams) h2h[t] = { ...baseH2h[t] }
    let c = code
    for (let i = 0; i < k; i++) {
      const outcome = c % 3
      c = (c - outcome) / 3
      applyResult(pts, h2h, remaining[i][0], remaining[i][1], outcome)
    }
    const tiers = rankTiers(teams, pts, h2h)
    let offset = 0
    for (const tier of tiers) {
      const best = offset + 1
      const worst = offset + tier.length
      for (const x of tier) {
        if (best === 1) canFirst[x] = true
        if (best <= 2) canTop2[x] = true
        if (best <= 3) canTop3[x] = true
        if (best !== 1 || worst !== 1) mustFirst[x] = false
        if (worst > 2) mustTop2[x] = false
        if (best !== 2 || worst !== 2) mustSecond[x] = false
      }
      offset += tier.length
    }
  }

  const clinchedFirst = teams.find((t) => mustFirst[t]) ?? null
  const clinchedTop2 = teams.filter((t) => mustTop2[t])
  const eliminatedFromFirst = teams.filter((t) => !canFirst[t])
  const eliminatedFromTop2 = teams.filter((t) => !canTop2[t])
  const eliminatedFromTop3 = teams.filter((t) => !canTop3[t])

  // Exact 1st/2nd order locked: a clinched winner plus exactly one team guaranteed to be 2nd.
  let top2OrderLocked = null
  if (clinchedFirst) {
    const seconds = teams.filter((t) => t !== clinchedFirst && mustSecond[t])
    if (seconds.length === 1) top2OrderLocked = [clinchedFirst, seconds[0]]
  }

  return {
    teams,
    complete: totalMatches > 0 && finishedCount === totalMatches,
    clinchedFirst,
    top2OrderLocked,
    clinchedTop2,
    eliminatedFromFirst,
    eliminatedFromTop2,
    eliminatedFromTop3,
    pts: basePts,
  }
}
