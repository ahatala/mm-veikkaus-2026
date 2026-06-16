<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store } from '../store'
import { CATEGORIES, pts } from '../ui'

const STORAGE_KEY = 'mm-veikkaus-2026:pelaaja'
const names = computed(() => store.bets!.participants)

// Remember the last-viewed player across visits (you'll keep checking your own results).
const readStored = () => { try { return localStorage.getItem(STORAGE_KEY) } catch { return null } }
const stored = readStored()
const sel = ref(stored && names.value.includes(stored) ? stored : store.computed!.standings[0].name)
watch(sel, (name) => { try { localStorage.setItem(STORAGE_KEY, name) } catch { /* ignore */ } })

const c = computed(() => store.computed!)
const row = computed(() => c.value.standings.find((r) => r.name === sel.value)!)

const playedMatches = computed(() =>
  c.value.matches.filter((m) => m.actual).map((m) => ({
    label: `${m.match.group} ${m.match.home} – ${m.match.away}`,
    pick: m.match.picks[sel.value] ?? '–',
    actual: m.actual!,
    points: m.points[sel.value] ?? 0,
  })),
)
const golden = computed(() => c.value.goldenBoot.byName[sel.value] ?? [])

const koRounds = computed(() => ([
  { key: 'quarterfinalists', label: 'Top 8', set: c.value.quarterfinalists },
  { key: 'semifinalists', label: 'Top 4', set: c.value.semifinalists },
  { key: 'finalists', label: 'Finalistit', set: c.value.finalists },
] as const).map((r) => ({
  ...r,
  picks: store.bets!.knockout[r.key].picks[sel.value] ?? [],
  correct: r.set.correctByName[sel.value] ?? [],
  points: r.set.points[sel.value],
})))

const top2 = computed(() => c.value.top2.map((t) => ({
  group: t.group,
  pick: store.bets!.groupTop2.find((g) => g.group === t.group)!.picks[sel.value] ?? '–',
  resolved: t.resolved,
  correct: t.resolved && store.bets!.groupTop2.find((g) => g.group === t.group)!.picks[sel.value] === t.correctAnswer,
  points: t.points[sel.value],
})))
const special = computed(() => c.value.special.map((s) => ({
  text: s.question.text,
  pick: s.question.picks[sel.value] ?? '–',
  resolved: s.resolved,
  points: s.points[sel.value],
})))
</script>

<template>
  <div class="card">
    <h2 style="display:flex;justify-content:space-between;align-items:center;gap:12px">
      <span>Pelaajan erittely</span>
      <select v-model="sel">
        <option v-for="n in names" :key="n" :value="n">{{ n }}</option>
      </select>
    </h2>
    <div class="breakdown-grid">
      <div class="row" v-for="cat in CATEGORIES" :key="cat.key">
        <span class="lbl">{{ cat.label }}</span>
        <span class="points" :class="{ zero: row.breakdown[cat.key] === 0 }">{{ pts(row.breakdown[cat.key]) }}</span>
      </div>
      <div class="row" style="grid-column:1/-1;border-top:1px solid var(--line);padding-top:6px;margin-top:2px">
        <span class="lbl"><strong>Yhteensä</strong></span>
        <span class="points">{{ row.total }}</span>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Kultakenkä</h3>
    <div class="chips">
      <span v-for="(l, i) in golden" :key="i" class="chip" :class="{ 'chip--bonus': l.goals > 0 }">
        {{ l.player }}<strong v-if="l.goals > 0"> · {{ l.goals }}⚽ {{ l.points }}p</strong>
      </span>
    </div>
  </div>

  <div class="card">
    <h3>Pudotuspeliveikkaukset</h3>
    <div v-for="r in koRounds" :key="r.key" style="margin-bottom:8px">
      <span class="muted" style="font-size:12px">{{ r.label }} ({{ r.points }} p)</span>
      <div class="chips" style="margin-top:3px">
        <span v-for="team in r.picks" :key="team" class="chip" :class="{ 'chip--correct': r.correct.includes(team) }">{{ team }}</span>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Lohkon Top 2</h3>
    <div class="chips">
      <span v-for="t in top2" :key="t.group" class="chip"
        :class="{ 'chip--correct': t.points > 0, 'chip--pending': !t.resolved }">
        {{ t.group }}: {{ t.pick }}<strong v-if="t.points"> +{{ t.points }}</strong>
      </span>
    </div>
  </div>

  <div class="card">
    <h3>Erikoiskysymykset</h3>
    <div class="rows">
      <div class="lrow" v-for="(s, i) in special" :key="i">
        <span class="lmain">{{ s.text }}</span>
        <span class="qpick">{{ s.pick }}</span>
        <span class="points lpts" :class="{ zero: s.points === 0 }">{{ s.resolved ? pts(s.points) : '—' }}</span>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Pelatut alkulohko-ottelut</h3>
    <p class="muted hint">veikkaus → tulos · pisteet</p>
    <div class="rows">
      <div class="lrow" v-for="(m, i) in playedMatches" :key="i">
        <span class="lmain">{{ m.label }}</span>
        <span class="signs">
          <span class="sign" :class="`sign--${m.pick}`">{{ m.pick }}</span>
          <span class="arrow">→</span>
          <span class="sign" :class="`sign--${m.actual}`">{{ m.actual }}</span>
        </span>
        <span class="points lpts" :class="{ zero: m.points === 0 }">{{ pts(m.points) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint { font-size: 11.5px; margin: -4px 0 8px; }
.rows { display: flex; flex-direction: column; }
.lrow {
  display: grid;
  grid-template-columns: 1fr auto 2.6em;
  gap: 10px;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
}
.lrow:last-child { border-bottom: none; }
.lmain { min-width: 0; overflow-wrap: anywhere; font-size: 13px; }
.signs { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
.signs .arrow { color: var(--muted); font-weight: 400; }
.lpts { text-align: right; }
.qpick { font-weight: 700; }
</style>
