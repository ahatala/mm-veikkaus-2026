<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import type { Top2Result } from '../scoring/types'

const participants = computed(() => store.bets!.participants)
const top2 = computed(() => store.computed!.top2)
const standings = computed(() => store.computed!.groupStandings)

function chipClass(t: Top2Result, name: string): string {
  const pick = store.bets!.groupTop2.find((g) => g.group === t.group)!.picks[name]
  if (!t.resolved) return 'chip--pending'
  return pick === t.correctAnswer ? 'chip--correct' : 'chip--wrong'
}
function pickOf(t: Top2Result, name: string) {
  return store.bets!.groupTop2.find((g) => g.group === t.group)!.picks[name] ?? '–'
}
</script>

<template>
  <div class="card">
    <h2>Lohkot &amp; Top 2 -veikkaukset</h2>
    <p class="muted" style="font-size:12.5px;margin-top:0">
      Top 2 = veikkaus toteutuuko lohkon kahden parhaan ilmoitettu järjestys (Kyllä/Ei, 2 p oikeasta).
    </p>
  </div>

  <div class="card" v-for="t in top2" :key="t.group">
    <h2 style="display:flex;justify-content:space-between;align-items:center">
      <span>{{ t.group }}-lohko — {{ t.label }}</span>
      <span class="pill" v-if="!t.resolved">ratkeamatta</span>
      <span class="pill" v-else-if="t.orderHolds" style="color:var(--green)">toteutui ✓</span>
      <span class="pill" v-else style="color:var(--red)">ei toteutunut</span>
    </h2>

    <div v-if="standings[t.group]?.length" style="margin-bottom:10px">
      <h3>Lohkon päätösjärjestys</h3>
      <ol style="margin:0;padding-left:20px">
        <li v-for="(team, i) in standings[t.group]" :key="team" :class="{ points: i < 2 }">{{ team }}</li>
      </ol>
    </div>

    <h3>Veikkaukset</h3>
    <div class="chips">
      <span v-for="name in participants" :key="name" class="chip" :class="chipClass(t, name)">
        {{ name }} <strong>{{ pickOf(t, name) }}</strong>
      </span>
    </div>
  </div>
</template>
