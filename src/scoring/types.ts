export type Sign = '1' | 'X' | '2'
export type YesNo = 'Kyllä' | 'Ei'

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
  /** group letter -> final standings as an ordered list of team names (position 1 first) */
  groupStandings: Record<string, string[]>
  knockout: {
    quarterfinalists: string[]
    semifinalists: string[]
    finalists: string[]
    champion: string | null
  }
  /** normalized player key -> goals (excl. shootout & own goals) */
  goldenBootGoals: Record<string, number>
}

export interface Overrides {
  /** sqId -> actual Kyllä/Ei answer (jury-resolved) */
  specialAnswers: Record<string, YesNo>
  corrections?: {
    groupMatches?: Record<string, Sign>
    goldenBootGoals?: Record<string, number>
    knockout?: Partial<Results['knockout']>
    groupStandings?: Record<string, string[]>
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
  points: Record<string, number>
}

export interface Computed {
  lastUpdated: string | null
  standings: StandingRow[]
  /** merged final group standings (group letter -> ordered team names) for display */
  groupStandings: Record<string, string[]>
  matches: MatchResult[]
  top2: Top2Result[]
  quarterfinalists: TeamSetResult
  semifinalists: TeamSetResult
  finalists: TeamSetResult
  champion: ChampionResult
  goldenBoot: GoldenResult
  special: SpecialResult[]
}
