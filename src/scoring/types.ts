export type Sign = '1' | 'X' | '2'
export type YesNo = 'Kyllä' | 'Ei'

export interface GoalEvent {
  name: string
  side?: 'home' | 'away'
  minute?: string | number | null
  penalty?: boolean
  owngoal?: boolean
}

export interface LiveMatch {
  id: string
  home: string
  away: string
  group: string
  homeScore: number
  awayScore: number
  minute: string | number | null
  status: string
}

export interface GroupMatch {
  id: string
  date: string
  group: string
  time: string
  home: string
  away: string
  picks: Record<string, Sign | null>
}

export interface GroupTop2 {
  group: string
  order: string[]
  label: string
  picks: Record<string, YesNo | null>
}

export interface GroupTableRow {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
}

export interface TeamSet {
  slots: number
  pointsPerTeam: number
  picks: Record<string, string[]>
}

export interface Knockout {
  quarterfinalists: TeamSet
  semifinalists: TeamSet
  finalists: TeamSet
  champion: { pointsPerTeam: number; picks: Record<string, string> }
}

export interface GoldenBoot {
  picksPerPlayer: number
  scoring: { firstGoal: number; secondGoal: number; subsequent: number }
  banned: string[]
  picks: Record<string, string[]>
}

export interface SpecialQuestion {
  id: string
  text: string
  points: number
  picks: Record<string, YesNo | null>
}

export interface Bets {
  meta: { title: string; participantCount: number; source: string }
  participants: string[]
  groupMatches: GroupMatch[]
  groupTop2: GroupTop2[]
  knockout: Knockout
  goldenBoot: GoldenBoot
  specialQuestions: SpecialQuestion[]
}

export interface Results {
  lastUpdated: string | null
  source?: string
  /** matchId -> actual 1/X/2 sign, only for finished matches */
  groupMatches: Record<string, Sign>
  /** matchId -> final score + goalscorers, for finished group matches */
  matchResults?: Record<string, { homeScore: number; awayScore: number; scorers?: GoalEvent[] }>
  /** in-play group matches (live score + minute) */
  live?: LiveMatch[]
  /** group letter -> final standings as an ordered list of team names (position 1 first); complete groups only */
  groupStandings: Record<string, string[]>
  /** group letter -> current standings rows (every group, incl. in-progress) for display */
  groupTable?: Record<string, GroupTableRow[]>
  /** group letter -> decided [1st, 2nd] (clinched early by points, or final) — drives Top-2 scoring */
  groupTop2?: Record<string, string[]>
  /** group letter -> elimination sets, enabling early "No" on a Top-2 bet that's become impossible */
  groupClinch?: Record<string, { eliminatedFromFirst: string[]; eliminatedFromTop2: string[] }>
  /** teams out of the tournament (group-stage certain-last, or knockout losers) — lost causes for knockout picks */
  eliminatedTeams?: string[]
  knockout: {
    quarterfinalists: string[]
    semifinalists: string[]
    finalists: string[]
    champion: string | null
  }
  /** normalized player key -> goals (excl. shootout & own goals) */
  goldenBootGoals: Record<string, number>
  /** auto-resolved special-question answers (sqId -> Kyllä/Ei); overrides take precedence */
  specialAnswers?: Record<string, YesNo>
  /** human-readable justification per auto-resolved answer (sqId -> reason) */
  specialReasons?: Record<string, string>
}

export interface Overrides {
  /** sqId -> actual Kyllä/Ei answer (jury-resolved) */
  specialAnswers: Record<string, YesNo>
  corrections?: {
    groupMatches?: Record<string, Sign>
    goldenBootGoals?: Record<string, number>
    knockout?: Partial<Results['knockout']>
    groupStandings?: Record<string, string[]>
    groupTop2?: Record<string, string[]>
  }
}

// ---- computed output ----
export interface Breakdown {
  groupMatches: number
  groupTop2: number
  quarterfinalists: number
  semifinalists: number
  finalists: number
  champion: number
  goldenBoot: number
  specialQuestions: number
}

export interface StandingRow {
  rank: number
  name: string
  total: number
  breakdown: Breakdown
}

export interface MatchResult {
  match: GroupMatch
  actual: Sign | null
  voters: number
  correctVoters: number
  bonus: boolean
  points: Record<string, number>
  score: { home: number; away: number } | null
  scorers: GoalEvent[]
}

export interface Top2Result {
  group: string
  order: string[]
  label: string
  actualTop2: string[] | null
  resolved: boolean
  orderHolds: boolean | null
  correctAnswer: YesNo | null
  points: Record<string, number>
}

export interface TeamSetResult {
  actual: string[]
  pointsPerTeam: number
  /** name -> the participant's picked teams that were correct */
  correctByName: Record<string, string[]>
  points: Record<string, number>
}

export interface ChampionResult {
  actual: string | null
  points: Record<string, number>
}

export interface GoldenPlayerLine {
  player: string
  goals: number
  points: number
}

export interface GoldenResult {
  /** name -> per-pick lines */
  byName: Record<string, GoldenPlayerLine[]>
  points: Record<string, number>
}

export interface SpecialResult {
  question: SpecialQuestion
  answer: YesNo | null
  resolved: boolean
  /** justification for the auto-resolved answer (null if jury-set or unresolved) */
  reason: string | null
  points: Record<string, number>
}

export interface LiveResult {
  match: GroupMatch
  homeScore: number
  awayScore: number
  minute: string | number | null
  status: string
  provisionalSign: Sign
  bonus: boolean
  /** provisional points if the match ended right now */
  points: Record<string, number>
}

export interface Computed {
  lastUpdated: string | null
  standings: StandingRow[]
  /** in-play matches with provisional scoring (empty when nothing is live) */
  live: LiveResult[]
  /** merged final group standings (group letter -> ordered team names) for display */
  groupStandings: Record<string, string[]>
  /** current standings rows per group (every group, incl. in-progress) for display */
  groupTable: Record<string, GroupTableRow[]>
  /** teams out of the tournament — lost causes for knockout picks */
  eliminated: string[]
  matches: MatchResult[]
  top2: Top2Result[]
  quarterfinalists: TeamSetResult
  semifinalists: TeamSetResult
  finalists: TeamSetResult
  champion: ChampionResult
  goldenBoot: GoldenResult
  special: SpecialResult[]
}
