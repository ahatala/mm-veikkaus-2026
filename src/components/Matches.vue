<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, nextTick, ref } from 'vue'
import { store } from '../store'
import type { MatchResult, GoalEvent, LiveResult } from '../scoring/types'

const participants = computed(() => store.bets!.participants)
const live = computed(() => store.computed!.live)

function provChip(l: LiveResult, name: string): string {
  const pick = l.match.picks[name]
  if (pick !== l.provisionalSign) return 'chip--wrong'
  return l.bonus ? 'chip--bonus' : 'chip--correct'
}

// Group matches by their date label, preserving chronological order.
const byDay = computed(() => {
  const groups: { date: string; matches: MatchResult[] }[] = []
  for (const m of store.computed!.matches) {
    const last = groups[groups.length - 1]
    if (last && last.date === m.match.date) last.matches.push(m)
    else groups.push({ date: m.match.date, matches: [m] })
  }
  return groups
})

// Anchor = the next unplayed match (or the last match once the group stage is over).
const anchorId = computed(() => {
  const ms = store.computed!.matches
  return (ms.find((m) => m.actual == null) ?? ms[ms.length - 1])?.match.id ?? null
})

function chipClass(m: MatchResult, name: string): string {
  const pick = m.match.picks[name]
  if (!m.actual) return 'chip--pending'
  if (pick !== m.actual) return 'chip--wrong'
  return m.bonus ? 'chip--bonus' : 'chip--correct'
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

// Scroll box + "go to current" control.
const scrollBox = ref<HTMLElement | null>(null)
const jumpDir = ref<'up' | 'down' | null>(null) // shown only when the anchor is off-screen

const anchorEl = () => scrollBox.value?.querySelector('[data-anchor="true"]') as HTMLElement | null

function centerOnAnchor(smooth = false) {
  const box = scrollBox.value
  const el = anchorEl()
  if (!box || !el) return
  const offset = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
  const top = Math.max(0, offset - box.clientHeight / 2 + el.clientHeight / 2)
  if (smooth && typeof box.scrollTo === 'function') box.scrollTo({ top, behavior: 'smooth' })
  else box.scrollTop = top
}

function updateJumpDir() {
  const box = scrollBox.value
  const el = anchorEl()
  if (!box || !el) { jumpDir.value = null; return }
  const b = box.getBoundingClientRect()
  const e = el.getBoundingClientRect()
  if (e.bottom > b.top + 8 && e.top < b.bottom - 8) jumpDir.value = null // already in view
  else jumpDir.value = e.top + e.height / 2 < (b.top + b.bottom) / 2 ? 'up' : 'down'
}

onMounted(async () => {
  await nextTick()
  centerOnAnchor(false)
  updateJumpDir()
  scrollBox.value?.addEventListener('scroll', updateJumpDir, { passive: true })
})
onBeforeUnmount(() => scrollBox.value?.removeEventListener('scroll', updateJumpDir))
</script>

<template>
  <div v-if="live.length" class="card live-card">
    <div class="live-head"><span class="live-dot" /> Käynnissä nyt</div>
    <div v-for="l in live" :key="l.match.id" class="live-match">
      <div class="meta">Lohko {{ l.match.group }} · <strong>{{ l.minute ? `${l.minute}'` : 'LIVE' }}</strong></div>
      <div class="grid">
        <span class="team home" :class="{ win: l.provisionalSign === '1' }">{{ l.match.home }}</span>
        <span class="score live-score">{{ l.homeScore }}–{{ l.awayScore }}</span>
        <span class="team away" :class="{ win: l.provisionalSign === '2' }">{{ l.match.away }}</span>
      </div>
      <div class="picks">
        <span v-for="name in participants" :key="name" class="chip" :class="provChip(l, name)">
          {{ name }} <strong>{{ l.match.picks[name] ?? '–' }}</strong>
        </span>
      </div>
      <div class="prov-note">alustavat pisteet — jos ottelu päättyisi nyt</div>
    </div>
  </div>

  <div class="card">
    <h2>Ottelut</h2>
    <div class="legend">
      <span class="chip chip--correct">oikein (+1)</span>
      <span class="chip chip--bonus">oikein + rohkea (+3)</span>
      <span class="chip chip--wrong">väärin</span>
      <span class="chip chip--pending">pelaamatta</span>
    </div>

    <div class="match-scroll-wrap">
      <button
        v-if="jumpDir" class="jump" :title="'Siirry nykyhetkeen'"
        @click="centerOnAnchor(true)"
      >
        <span class="arrow">{{ jumpDir === 'up' ? '↑' : '↓' }}</span> Nyt
      </button>
      <div class="match-scroll" ref="scrollBox">
        <div class="day" v-for="day in byDay" :key="day.date">
        <div class="day-date">{{ day.date }}</div>
        <div class="day-matches">
          <div
            v-for="m in day.matches" :key="m.match.id"
            class="match" :class="{ anchor: m.match.id === anchorId, played: !!m.actual }"
            :data-anchor="m.match.id === anchorId"
          >
            <div class="meta">Lohko {{ m.match.group }} · {{ m.match.time }}</div>

            <div class="grid">
              <span class="team home" :class="{ win: m.actual === '1' }">{{ m.match.home }}</span>
              <span v-if="m.score" class="score">{{ m.score.home }}–{{ m.score.away }}</span>
              <span v-else class="score pending">–</span>
              <span class="team away" :class="{ win: m.actual === '2' }">{{ m.match.away }}</span>

              <template v-if="m.actual && m.scorers.length">
                <span class="scorers home">{{ scorersOn(m, 'home') }}</span>
                <span class="scorers mid">⚽</span>
                <span class="scorers away">{{ scorersOn(m, 'away') }}</span>
              </template>
            </div>

            <div class="picks">
              <span v-for="name in participants" :key="name" class="chip" :class="chipClass(m, name)">
                {{ name }} <strong>{{ m.match.picks[name] ?? '–' }}</strong>
              </span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- live "ongoing now" card ---- */
.live-card { border-color: var(--red); }
.live-head {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 15px; color: var(--red); margin-bottom: 10px;
}
.live-dot {
  width: 9px; height: 9px; border-radius: 50%; background: var(--red);
  box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.7); animation: pulse 1.4s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(248, 113, 113, 0); }
  100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0); }
}
.live-match + .live-match { border-top: 1px solid var(--line); padding-top: 10px; margin-top: 10px; }
.live-score { color: var(--red); font-size: 16px; }
.prov-note { font-size: 11px; color: var(--muted); font-style: italic; margin-top: 6px; }

.match-scroll-wrap { position: relative; }
.jump {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: #0b1020;
  background: var(--accent);
  border: none;
  border-radius: 999px;
  padding: 7px 13px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}
.jump:hover { filter: brightness(1.08); }
.jump .arrow { font-size: 14px; line-height: 1; }

.match-scroll {
  max-height: min(74vh, 780px);
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg);
}

.day {
  display: grid;
  grid-template-columns: 76px 1fr;
}
.day + .day { border-top: 1px solid var(--line); }
.day-date {
  position: sticky;
  top: 0;
  align-self: start;
  padding: 12px 8px 12px 12px;
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
.match.anchor { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }

.meta { color: var(--muted); font-size: 11.5px; margin-bottom: 3px; }

/* Two rows sharing one column template, so scorers align under their team. */
.grid {
  display: grid;
  grid-template-columns: 1fr 3.4em 1fr;
  column-gap: 10px;
  row-gap: 1px;
  align-items: baseline;
}
.team { font-weight: 600; font-size: 14px; }
.team.home { text-align: right; }
.team.away { text-align: left; }
.team.win { color: var(--green); }
.score { text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; }
.score.pending { color: var(--muted); font-weight: 500; }
.scorers { font-size: 11.5px; color: var(--muted); }
.scorers.home { text-align: right; }
.scorers.away { text-align: left; }
.scorers.mid { text-align: center; opacity: 0.6; }

.picks { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.picks .chip { font-size: 11px; padding: 2px 7px; }
</style>
