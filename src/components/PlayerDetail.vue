<script setup lang="ts">
import { computed, ref } from 'vue'
import { store } from '../store'
import { CATEGORIES, pts } from '../ui'

const names = computed(() => store.bets!.participants)
const sel = ref(store.computed!.standings[0].name) // default to the current leader

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
    <table>
      <tbody>
        <tr v-for="(s, i) in special" :key="i">
          <td>{{ s.text }}</td>
          <td style="width:4em" class="center"><strong>{{ s.pick }}</strong></td>
          <td class="num"><span class="points" :class="{ zero: s.points === 0 }">{{ s.resolved ? pts(s.points) : '—' }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h3>Pelatut alkulohko-ottelut</h3>
    <table>
      <thead><tr><th>Ottelu</th><th class="center">Veikkaus</th><th class="center">Tulos</th><th class="num">Pisteet</th></tr></thead>
      <tbody>
        <tr v-for="(m, i) in playedMatches" :key="i">
          <td>{{ m.label }}</td>
          <td class="center"><strong>{{ m.pick }}</strong></td>
          <td class="center"><span class="sign" :class="`sign--${m.actual}`">{{ m.actual }}</span></td>
          <td class="num"><span class="points" :class="{ zero: m.points === 0 }">{{ pts(m.points) }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
