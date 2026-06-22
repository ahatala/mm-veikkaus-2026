import { key } from './normalize'
import type {
  Bets, Results, Overrides, Sign, YesNo, Breakdown, StandingRow, MatchResult, Top2Result,
  TeamSetResult, ChampionResult, GoldenResult, GoldenPlayerLine, SpecialResult, Computed, TeamSet,
  LiveResult,
} from './types'

const zero = (names: string[]): Record<string, number> =>
  Object.fromEntries(names.map((n) => [n, 0]))

/** Group match 1/X/2: +1 for correct sign, +3 if correct AND fewer than 1/3 of voters picked it. */
export function scoreMatches(
  bets: Bets,
  actual: Record<string, Sign>,
  matchResults: Results['matchResults'] = {},
): MatchResult[] {
  return bets.groupMatches.map((match) => {
    const sign = actual[match.id] ?? null
    const points = zero(bets.participants)
    const mr = matchResults?.[match.id]
    const score = mr ? { home: mr.homeScore, away: mr.awayScore } : null
    const scorers = mr?.scorers ?? []
    let voters = 0
    let correctVoters = 0
    if (sign) {
      for (const name of bets.participants) {
        const pick = match.picks[name]
        if (pick) voters++
        if (pick === sign) correctVoters++
      }
      // "alle 1/3 veikkaajista" — strictly fewer than a third of voters picked the winning sign.
      const bonus = correctVoters > 0 && correctVoters < voters / 3
      for (const name of bets.participants) {
        if (match.picks[name] === sign) points[name] = bonus ? 3 : 1
      }
      return { match, actual: sign, voters, correctVoters, bonus, points, score, scorers }
    }
    return { match, actual: null, voters, correctVoters, bonus: false, points, score, scorers }
  })
}

/**
 * Group Top 2: +2 if the Kyllä/Ei answer about the stated exact 1st/2nd order is correct.
 * Resolves as soon as the order is mathematically decided (clinched early or final). Can also resolve
 * "Ei" early when the predicted order has become impossible (predicted winner can't win, or predicted
 * runner-up can't finish top 2).
 */
export function scoreTop2(
  bets: Bets,
  top2ByGroup: Record<string, string[]>,
  clinchByGroup: Record<string, { eliminatedFromFirst: string[]; eliminatedFromTop2: string[] }> = {},
): Top2Result[] {
  return bets.groupTop2.map((g) => {
    const points = zero(bets.participants)
    const order = top2ByGroup[g.group]
    const clinch = clinchByGroup[g.group]
    let resolved = false
    let orderHolds: boolean | null = null
    let actualTop2: string[] | null = null

    if (order && order.length >= 2) {
      actualTop2 = [order[0], order[1]]
      orderHolds = key(order[0]) === key(g.order[0]) && key(order[1]) === key(g.order[1])
      resolved = true
    } else if (
      clinch &&
      ((clinch.eliminatedFromFirst ?? []).some((tm) => key(tm) === key(g.order[0])) ||
        (clinch.eliminatedFromTop2 ?? []).some((tm) => key(tm) === key(g.order[1])))
    ) {
      orderHolds = false // predicted order can no longer happen
      resolved = true
    }

    const correctAnswer: YesNo | null = resolved ? (orderHolds ? 'Kyllä' : 'Ei') : null
    if (correctAnswer) for (const name of bets.participants) if (g.picks[name] === correctAnswer) points[name] = 2
    return { group: g.group, order: g.order, label: g.label, actualTop2, resolved, orderHolds, correctAnswer, points }
  })
}

/** Knockout team set (QF/SF/Finalists): pointsPerTeam for each picked team that actually reached the round. */
export function scoreTeamSet(bets: Bets, set: TeamSet, actual: string[]): TeamSetResult {
  const actualKeys = new Set(actual.map(key))
  const points = zero(bets.participants)
  const correctByName: Record<string, string[]> = {}
  for (const name of bets.participants) {
    const correct = (set.picks[name] ?? []).filter((team) => actualKeys.has(key(team)))
    correctByName[name] = correct
    points[name] = correct.length * set.pointsPerTeam
  }
  return { actual, pointsPerTeam: set.pointsPerTeam, correctByName, points }
}

export function scoreChampion(bets: Bets, actual: string | null): ChampionResult {
  const points = zero(bets.participants)
  if (actual) {
    const a = key(actual)
    for (const name of bets.participants) {
      if (key(bets.knockout.champion.picks[name]) === a) points[name] = bets.knockout.champion.pointsPerTeam
    }
  }
  return { actual, points }
}

/** Per player: firstGoal pts for the 1st goal, secondGoal for the 2nd, subsequent for each after. */
export function goldenPointsForGoals(goals: number, s: Bets['goldenBoot']['scoring']): number {
  if (goals <= 0) return 0
  return s.firstGoal + (goals >= 2 ? s.secondGoal : 0) + Math.max(0, goals - 2) * s.subsequent
}

export function scoreGoldenBoot(bets: Bets, goals: Record<string, number>): GoldenResult {
  const bannedKeys = new Set(bets.goldenBoot.banned.map(key))
  const points = zero(bets.participants)
  const byName: Record<string, GoldenPlayerLine[]> = {}
  for (const name of bets.participants) {
    const lines: GoldenPlayerLine[] = (bets.goldenBoot.picks[name] ?? []).map((player) => {
      const g = bannedKeys.has(key(player)) ? 0 : goals[key(player)] ?? 0
      return { player, goals: g, points: goldenPointsForGoals(g, bets.goldenBoot.scoring) }
    })
    byName[name] = lines
    points[name] = lines.reduce((sum, l) => sum + l.points, 0)
  }
  return { byName, points }
}

/** Provisional scoring for in-play matches — "if it ended right now" (same +1/+3 rule as final). */
export function scoreLive(bets: Bets, live: Results['live'] = []): LiveResult[] {
  return (live ?? [])
    .map((L): LiveResult | null => {
      const match = bets.groupMatches.find((m) => m.id === L.id)
      if (!match) return null
      const sign: Sign = L.homeScore > L.awayScore ? '1' : L.homeScore < L.awayScore ? '2' : 'X'
      const points = zero(bets.participants)
      let voters = 0
      let correctVoters = 0
      for (const name of bets.participants) {
        const pick = match.picks[name]
        if (pick) voters++
        if (pick === sign) correctVoters++
      }
      const bonus = correctVoters > 0 && correctVoters < voters / 3
      for (const name of bets.participants) if (match.picks[name] === sign) points[name] = bonus ? 3 : 1
      return { match, homeScore: L.homeScore, awayScore: L.awayScore, minute: L.minute, status: L.status, provisionalSign: sign, bonus, points }
    })
    .filter((x): x is LiveResult => x !== null)
}

export function scoreSpecial(
  bets: Bets,
  answers: Record<string, YesNo>,
  reasons: Record<string, string> = {},
): SpecialResult[] {
  return bets.specialQuestions.map((q) => {
    const answer = answers[q.id] ?? null
    const points = zero(bets.participants)
    if (answer) {
      for (const name of bets.participants) {
        if (q.picks[name] === answer) points[name] = q.points
      }
    }
    return { question: q, answer, resolved: answer != null, reason: reasons[q.id] ?? null, points }
  })
}

const sumPoints = (recs: Record<string, number>[], name: string): number =>
  recs.reduce((s, r) => s + (r[name] ?? 0), 0)

/** Full computation: per-category detail + the sorted leaderboard. Pure — safe to call in the UI. */
export function compute(bets: Bets, results: Results, overrides: Overrides): Computed {
  const c = overrides.corrections ?? {}
  const actualSigns = { ...results.groupMatches, ...(c.groupMatches ?? {}) }
  const standings = { ...results.groupStandings, ...(c.groupStandings ?? {}) }
  const goals = { ...results.goldenBootGoals, ...(c.goldenBootGoals ?? {}) }
  const ko = { ...results.knockout, ...(c.knockout ?? {}) }

  // Decided Top-2 order per group: explicit (clinched/final) wins, with full standings as a fallback.
  const top2ByGroup: Record<string, string[]> = { ...(results.groupTop2 ?? {}), ...(c.groupTop2 ?? {}) }
  for (const [g, order] of Object.entries(standings)) {
    if (!top2ByGroup[g] && order.length >= 2) top2ByGroup[g] = [order[0], order[1]]
  }

  const matches = scoreMatches(bets, actualSigns, results.matchResults ?? {})
  const live = scoreLive(bets, results.live ?? [])
  const top2 = scoreTop2(bets, top2ByGroup, results.groupClinch ?? {})
  const quarterfinalists = scoreTeamSet(bets, bets.knockout.quarterfinalists, ko.quarterfinalists ?? [])
  const semifinalists = scoreTeamSet(bets, bets.knockout.semifinalists, ko.semifinalists ?? [])
  const finalists = scoreTeamSet(bets, bets.knockout.finalists, ko.finalists ?? [])
  const champion = scoreChampion(bets, ko.champion ?? null)
  const goldenBoot = scoreGoldenBoot(bets, goals)
  // Auto-resolved answers from the feed, with jury overrides taking precedence. A justification is
  // kept only when the displayed answer is still the auto-resolved one (a jury override drops it).
  const autoAnswers = results.specialAnswers ?? {}
  const specialAnswers = { ...autoAnswers, ...(overrides.specialAnswers ?? {}) }
  const specialReasons: Record<string, string> = {}
  for (const [id, reason] of Object.entries(results.specialReasons ?? {})) {
    if (specialAnswers[id] === autoAnswers[id]) specialReasons[id] = reason
  }
  const special = scoreSpecial(bets, specialAnswers, specialReasons)

  const matchPts = matches.map((m) => m.points)
  const top2Pts = top2.map((t) => t.points)
  const specialPts = special.map((s) => s.points)

  const rows: Omit<StandingRow, 'rank'>[] = bets.participants.map((name, index) => {
    const breakdown: Breakdown = {
      groupMatches: sumPoints(matchPts, name),
      groupTop2: sumPoints(top2Pts, name),
      quarterfinalists: quarterfinalists.points[name],
      semifinalists: semifinalists.points[name],
      finalists: finalists.points[name],
      champion: champion.points[name],
      goldenBoot: goldenBoot.points[name],
      specialQuestions: sumPoints(specialPts, name),
    }
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0)
    return { name, total, breakdown, _index: index } as unknown as Omit<StandingRow, 'rank'>
  })

  // Tie-break replicates the sheet: equal totals -> higher participant column index ranks first.
  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    return (b as any)._index - (a as any)._index
  })
  const standingsOut: StandingRow[] = rows.map((r, i) => {
    const { _index, ...rest } = r as any
    return { rank: i + 1, ...rest }
  })

  return {
    lastUpdated: results.lastUpdated,
    standings: standingsOut,
    live,
    groupStandings: standings,
    groupTable: results.groupTable ?? {},
    eliminated: results.eliminatedTeams ?? [],
    matches, top2, quarterfinalists, semifinalists, finalists, champion, goldenBoot, special,
  }
}
