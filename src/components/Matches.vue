<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, nextTick, ref } from 'vue'
import { store } from '../store'
import type { MatchResult, GoalEvent, KnockoutMatchResult, KnockoutBacker } from '../scoring/types'
import { flagUrl, flagCode } from '../flags'

const participants = computed(() => store.bets!.participants)

// A list row is a match's finished/upcoming data, OR — when it's in play — overridden with the live
// entry (same shape, provisional score/sign/points). Rendered by the exact same row template.
type Row = MatchResult & { isLive: boolean; minute: string | number | null }

const displayMatches = computed<Row[]>(() => {
  const liveById = new Map(store.computed!.live.map((l) => [l.match.id, l]))
  return store.computed!.matches.map((m): Row => {
    const l = liveById.get(m.match.id)
    if (!l) return { ...m, isLive: false, minute: null }
    return {
      ...m,
      score: { home: l.homeScore, away: l.awayScore },
      actual: l.provisionalSign,
      bonus: l.bonus,
      scorers: [],
      points: l.points,
      isLive: true,
      minute: l.minute,
    }
  })
})

const KO_LABEL: Record<string, string> = {
  R32: 'Kahdeksannesvälierä', R16: 'Neljännesvälierä', QF: 'Puolivälierä',
  SF: 'Välierä', '3RD': 'Pronssiottelu', FINAL: 'Finaali',
}
const backerText = (b: KnockoutBacker) => (b.points != null ? `${b.name} +${b.points}` : b.name)
const koPending = (stage: string) =>
  stage === 'R32' ? 'Ottelupari ratkeaa lohkovaiheen jälkeen' : 'Ottelupari ratkeaa edellisistä otteluista'
// Mirror the group-match rows: once decided, the winner's row is highlighted (gold), the loser dimmed.
function koRowClass(k: KnockoutMatchResult, side: 'HOME' | 'AWAY'): string {
  if (!k.winner) return ''
  return k.winner === side ? 'bonus' : 'wrong'
}

// One chronological list of group + knockout matches, grouped by date label. Group matches come first
// (they're earlier); the day they share with the first knockout round merges into one day block.
type ListItem = { type: 'group'; g: Row } | { type: 'ko'; k: KnockoutMatchResult }
const byDay = computed(() => {
  const items: { date: string; item: ListItem }[] = [
    ...displayMatches.value.map((g) => ({ date: g.match.date, item: { type: 'group', g } as ListItem })),
    ...store.computed!.knockoutMatches.map((k) => ({ date: k.date, item: { type: 'ko', k } as ListItem })),
  ]
  const days: { date: string; items: ListItem[] }[] = []
  for (const { date, item } of items) {
    const last = days[days.length - 1]
    if (last && last.date === date) last.items.push(item)
    else days.push({ date, items: [item] })
  }
  return days
})

// Anchor = the live match if any, else the next unplayed (else the last match).
const anchorId = computed(() => {
  const ms = store.computed!.matches
  const liveIds = new Set(store.computed!.live.map((l) => l.match.id))
  const liveM = ms.find((m) => liveIds.has(m.match.id))
  return (liveM ?? ms.find((m) => m.actual == null) ?? ms[ms.length - 1])?.match.id ?? null
})

// --- picks grouped by sign into compact full-width rows (1 / X / 2) ---
const SIGNS = ['1', 'X', '2'] as const
const pickers = (m: MatchResult, s: string): string[] =>
  participants.value.filter((n) => m.match.picks[n] === s)
const signRows = (m: MatchResult) =>
  SIGNS.map((s) => ({ s, names: pickers(m, s) })).filter((r) => r.names.length > 0)
function colClass(m: MatchResult, s: string): string {
  if (!m.actual) return 'pending'
  if (s !== m.actual) return 'wrong'
  return m.bonus ? 'bonus' : 'ok'
}

const minuteLabel = (g: GoalEvent) =>
  `${g.minute ? `${g.minute}'` : ''}${g.penalty ? ' (pen)' : ''}${g.owngoal ? ' (og)' : ''}`.trim()

// One entry per scorer, with all their goal times merged: "Havertz 12', 45' (pen)".
function scorersOn(m: MatchResult, side: 'home' | 'away'): string {
  const order: string[] = []
  const byName = new Map<string, GoalEvent[]>()
  for (const g of m.scorers) {
    if (g.side !== side) continue
    if (!byName.has(g.name)) { byName.set(g.name, []); order.push(g.name) }
    byName.get(g.name)!.push(g)
  }
  return order
    .map((name) => {
      const times = byName.get(name)!.map(minuteLabel).filter(Boolean)
      return times.length ? `${name} ${times.join(', ')}` : name
    })
    .join(' · ')
}

// "Go to current" control. The whole page scrolls (no nested scroll container), so the button is a
// fixed pill that scrolls the window to the current match; it only shows when that match is off-screen.
const jumpDir = ref<'up' | 'down' | null>(null)
const anchorEl = () => document.querySelector('[data-anchor="true"]') as HTMLElement | null

function goToCurrent() {
  anchorEl()?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function updateJumpDir() {
  const el = anchorEl()
  if (!el) { jumpDir.value = null; return }
  const tabs = document.querySelector('.tabs') as HTMLElement | null
  const topLimit = tabs ? tabs.getBoundingClientRect().bottom : 56 // content hidden behind the sticky tabs
  const r = el.getBoundingClientRect()
  if (r.bottom <= topLimit + 8) jumpDir.value = 'up'
  else if (r.top >= window.innerHeight - 8) jumpDir.value = 'down'
  else jumpDir.value = null // visible
}

onMounted(async () => {
  await nextTick()
  updateJumpDir()
  window.addEventListener('scroll', updateJumpDir, { passive: true })
  window.addEventListener('resize', updateJumpDir, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateJumpDir)
  window.removeEventListener('resize', updateJumpDir)
})
</script>

<template>
  <div class="card">
    <h2>Ottelut</h2>

    <div class="days">
      <div class="day" v-for="day in byDay" :key="day.date">
        <div class="day-date">{{ day.date }}</div>
        <div class="day-matches">
          <template v-for="it in day.items">
            <!-- group match: 1/X/2 picks -->
            <div
              v-if="it.type === 'group'" :key="it.g.match.id"
              class="match" :class="{ anchor: it.g.match.id === anchorId, played: !!it.g.actual && !it.g.isLive, live: it.g.isLive }"
              :data-anchor="it.g.match.id === anchorId"
            >
              <div class="meta">
                Lohko {{ it.g.match.group }} ·
                <template v-if="it.g.isLive"><span class="live-dot"></span><span class="live-label">{{ it.g.minute ? `${it.g.minute}'` : 'LIVE' }}</span></template>
                <template v-else>{{ it.g.match.time }}</template>
              </div>

              <div class="grid">
                <span class="team home" :class="{ win: it.g.actual === '1' }">
                  <span class="tn">{{ it.g.match.home }}</span>
                  <img v-if="flagCode(it.g.match.home)" class="flag" :src="flagUrl(it.g.match.home)" alt="" loading="lazy" />
                </span>
                <span v-if="it.g.score" class="score">{{ it.g.score.home }}–{{ it.g.score.away }}</span>
                <span v-else class="score pending">–</span>
                <span class="team away" :class="{ win: it.g.actual === '2' }">
                  <img v-if="flagCode(it.g.match.away)" class="flag" :src="flagUrl(it.g.match.away)" alt="" loading="lazy" />
                  <span class="tn">{{ it.g.match.away }}</span>
                </span>

                <template v-if="it.g.actual && it.g.scorers.length">
                  <span class="scorers home">{{ scorersOn(it.g, 'home') }}</span>
                  <span class="scorers mid">⚽</span>
                  <span class="scorers away">{{ scorersOn(it.g, 'away') }}</span>
                </template>
              </div>

              <div class="picksrows">
                <div class="prow" v-for="r in signRows(it.g)" :key="r.s" :class="colClass(it.g, r.s)">
                  <span class="sign prow-sign" :class="`sign--${r.s}`">{{ r.s }}</span>
                  <span class="prow-names">{{ r.names.join(', ') }}</span>
                  <span v-if="r.s === it.g.actual" class="prow-pts">+{{ it.g.bonus ? 3 : 1 }}</span>
                </div>
              </div>
            </div>

            <!-- knockout match: no 1/X/2; show who benefits per team -->
            <div
              v-else :key="it.k.id"
              class="match ko" :class="{ played: it.k.finished }"
            >
              <div class="meta">{{ KO_LABEL[it.k.stage] }}<template v-if="it.k.time"> · {{ it.k.time }}</template></div>

              <div class="grid">
                <span class="team home" :class="{ win: it.k.winner === 'HOME' }">
                  <span class="tn">{{ it.k.home ?? 'TBD' }}</span>
                  <img v-if="it.k.home && flagCode(it.k.home)" class="flag" :src="flagUrl(it.k.home)" alt="" loading="lazy" />
                </span>
                <span v-if="it.k.homeScore != null" class="score">{{ it.k.homeScore }}–{{ it.k.awayScore }}</span>
                <span v-else class="score pending">–</span>
                <span class="team away" :class="{ win: it.k.winner === 'AWAY' }">
                  <img v-if="it.k.away && flagCode(it.k.away)" class="flag" :src="flagUrl(it.k.away)" alt="" loading="lazy" />
                  <span class="tn">{{ it.k.away ?? 'TBD' }}</span>
                </span>
              </div>

              <p v-if="!it.k.home && !it.k.away" class="ko-muted">{{ koPending(it.k.stage) }}</p>
              <div v-else class="picksrows">
                <div v-if="it.k.home" class="prow" :class="koRowClass(it.k, 'HOME')">
                  <span class="sign prow-sign sign--1">1</span>
                  <span class="prow-names">{{ it.k.homeBackers.length ? it.k.homeBackers.map(backerText).join(', ') : 'ei veikkauksia' }}</span>
                  <span v-if="it.k.winner === 'HOME' && it.k.prize && it.k.homeBackers.length" class="prow-pts">+{{ it.k.prize.points }}</span>
                </div>
                <div v-if="it.k.away" class="prow" :class="koRowClass(it.k, 'AWAY')">
                  <span class="sign prow-sign sign--2">2</span>
                  <span class="prow-names">{{ it.k.awayBackers.length ? it.k.awayBackers.map(backerText).join(', ') : 'ei veikkauksia' }}</span>
                  <span v-if="it.k.winner === 'AWAY' && it.k.prize && it.k.awayBackers.length" class="prow-pts">+{{ it.k.prize.points }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <button v-if="jumpDir" class="jump" :title="'Siirry nykyhetkeen'" @click="goToCurrent">
    <span class="arrow">{{ jumpDir === 'up' ? '↑' : '↓' }}</span> Nyt
  </button>
</template>

<style scoped>
/* in-play indicator shown inline in a live match's meta line */
.live-dot {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--red);
  vertical-align: middle; margin: 0 3px 1px 0; animation: pulse 1.4s infinite;
}
.live-label { color: var(--red); font-weight: 700; }
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.6); }
  70% { box-shadow: 0 0 0 6px rgba(248, 113, 113, 0); }
  100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0); }
}

/* fixed "go to current" pill (whole page scrolls) */
.jump {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 700;
  color: #0b1020;
  background: var(--accent);
  border: none;
  border-radius: 999px;
  padding: 9px 15px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}
.jump:hover { filter: brightness(1.08); }
.jump .arrow { font-size: 14px; line-height: 1; }

.day {
  display: grid;
  grid-template-columns: 76px 1fr;
}
.day + .day { border-top: 1px solid var(--line); }
.day-date {
  align-self: start;
  padding: 12px 8px 12px 4px;
  font-weight: 700;
  font-size: 14px;
  color: var(--accent);
  text-transform: capitalize;
  white-space: nowrap;
}
.day-matches {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 8px 12px 10px 2px;
}

.match {
  padding: 9px 12px 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
}
/* Completed matches get a subtle fill; upcoming stay fully transparent (outline only). */
.match.played { background: rgba(255, 255, 255, 0.03); }
.match.live { border-color: var(--red); box-shadow: 0 0 0 1px var(--red); }
.match.anchor { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.match.live.anchor { border-color: var(--red); box-shadow: 0 0 0 1px var(--red); }

.meta { color: var(--muted); font-size: 11.5px; margin-bottom: 3px; }

/* Two rows sharing one column template, so scorers align under their team. */
.grid {
  display: grid;
  grid-template-columns: 1fr 3.4em 1fr;
  column-gap: 10px;
  row-gap: 2px;
  align-items: center; /* center so team names + flag images line up (baseline breaks with images) */
}
.grid > * { min-width: 0; } /* let columns shrink instead of forcing horizontal overflow */
.team { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; min-width: 0; }
.team.home { justify-content: flex-end; text-align: right; }
.team.away { justify-content: flex-start; text-align: left; }
.team.win { color: var(--green); }
.tn { min-width: 0; overflow-wrap: anywhere; }
.flag {
  width: 21px; height: 15px; flex: none; border-radius: 2px;
  object-fit: cover; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.14);
}
.score { text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; }
.score.pending { color: var(--muted); font-weight: 500; }
.scorers { font-size: 11.5px; color: var(--muted); overflow-wrap: anywhere; }
.scorers.home { text-align: right; }
.scorers.away { text-align: left; }
.scorers.mid { text-align: center; opacity: 0.6; }

/* picks grouped by sign into compact full-width rows */
.picksrows {
  margin-top: 11px;
  padding: 7px 9px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.prow {
  display: flex; gap: 8px; font-size: 12.5px; line-height: 1.45; align-items: baseline;
  padding: 4px 8px; border: 1px solid transparent; border-radius: 8px;
}
.prow.ok { background: rgba(52, 211, 153, 0.10); border-color: rgba(52, 211, 153, 0.30); }
.prow.bonus { background: rgba(251, 191, 36, 0.12); border-color: rgba(251, 191, 36, 0.35); }
.prow-sign { flex: none; width: 1.2em; font-weight: 700; text-align: center; }
.prow-names { flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--muted); }
.prow-pts { flex: none; font-weight: 700; font-variant-numeric: tabular-nums; }
.prow.ok .prow-pts { color: var(--green); }
.prow.bonus .prow-pts { color: var(--gold); }
.prow.ok .prow-names { color: var(--green); }
.prow.bonus .prow-names { color: var(--gold); font-weight: 600; }
.prow.wrong .prow-names { opacity: 0.5; }
.prow.pending .prow-names { color: var(--muted); }

/* ---- knockout match: reuses the group .picksrows/.prow styling (1/2 rows, winner highlighted) ---- */
.match.ko { border-style: dashed; }
.match.ko.played { border-style: solid; }
.ko-muted { color: var(--muted); font-size: 12px; margin: 8px 0 0; font-style: italic; }

/* ---- narrow screens: date becomes a sticky header (no left column); 'Nyt' floats bottom-right ---- */
@media (max-width: 560px) {
  .day { display: block; }
  .day + .day { border-top: none; }
  .day-date {
    z-index: 2;
    align-self: stretch;
    padding: 7px 12px;
    background: var(--bg-elev2);
    border-bottom: 1px solid var(--line);
    white-space: normal;
  }
  .day-matches { padding: 8px 10px 12px; }
}
</style>
