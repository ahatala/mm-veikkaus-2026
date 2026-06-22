<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import { key } from '../scoring/normalize'
import type { Top2Result } from '../scoring/types'

const participants = computed(() => store.bets!.participants)
const top2 = computed(() => store.computed!.top2)
const tables = computed(() => store.computed!.groupTable)
// Teams out of the tournament — shown struck through in the table.
const eliminated = computed(() => new Set(store.computed!.eliminated.map((t) => key(t))))
const isDead = (team: string) => eliminated.value.has(key(team))

function chipClass(t: Top2Result, name: string): string {
  const pick = store.bets!.groupTop2.find((g) => g.group === t.group)!.picks[name]
  if (!t.resolved) return 'chip--pending'
  return pick === t.correctAnswer ? 'chip--correct' : 'chip--wrong'
}
function pickOf(t: Top2Result, name: string) {
  return store.bets!.groupTop2.find((g) => g.group === t.group)!.picks[name] ?? '–'
}
const gd = (n: number) => (n > 0 ? `+${n}` : `${n}`)
</script>

<template>
  <div class="card">
    <h2>Lohkot &amp; Top 2 -veikkaukset</h2>
    <p class="muted" style="font-size:12.5px;margin-top:0">
      Top 2 = veikkaus toteutuuko lohkon kahden parhaan ilmoitettu järjestys (Kyllä/Ei, 2 p oikeasta).
      Kaksi parasta jatkoon suoraan; viivan alle jäävät tippuvat (kolmosista 8 parasta jatkaa).
    </p>
  </div>

  <div class="card" v-for="t in top2" :key="t.group">
    <h2 style="display:flex;justify-content:space-between;align-items:center">
      <span>{{ t.group }}-lohko — {{ t.label }}</span>
      <span class="pill" v-if="!t.resolved">ratkeamatta</span>
      <span class="pill" v-else-if="t.orderHolds" style="color:var(--green)">toteutui ✓</span>
      <span class="pill" v-else style="color:var(--red)">ei toteutunut</span>
    </h2>

    <table class="gtable" v-if="tables[t.group]?.length">
      <thead>
        <tr><th>#</th><th>Joukkue</th><th class="num">O</th><th class="num">ME</th><th class="num">P</th></tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in tables[t.group]" :key="row.team"
            :class="{ 'gt-adv': i < 2, 'gt-dead': isDead(row.team) }">
          <td class="gt-pos">{{ i + 1 }}</td>
          <td class="gt-team">{{ row.team }}</td>
          <td class="num">{{ row.played }}</td>
          <td class="num">{{ gd(row.gd) }}</td>
          <td class="num"><strong>{{ row.points }}</strong></td>
        </tr>
      </tbody>
    </table>

    <h3>Veikkaukset</h3>
    <div class="chips">
      <span v-for="name in participants" :key="name" class="chip" :class="chipClass(t, name)">
        {{ name }} <strong>{{ pickOf(t, name) }}</strong>
      </span>
    </div>
  </div>
</template>
