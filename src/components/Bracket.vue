<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import type { TeamSetResult } from '../scoring/types'

const participants = computed(() => store.bets!.participants)
const c = computed(() => store.computed!)

const rounds = computed(() => [
  { key: 'quarterfinalists' as const, label: 'Top 8 — Puolivälierät', ppt: 5, set: c.value.quarterfinalists },
  { key: 'semifinalists' as const, label: 'Top 4 — Semifinaalit', ppt: 6, set: c.value.semifinalists },
  { key: 'finalists' as const, label: 'Finalistit', ppt: 8, set: c.value.finalists },
])

function picksOf(key: 'quarterfinalists' | 'semifinalists' | 'finalists', name: string): string[] {
  return store.bets!.knockout[key].picks[name] ?? []
}
function isCorrect(set: TeamSetResult, name: string, team: string): boolean {
  return (set.correctByName[name] ?? []).includes(team)
}
const championActual = computed(() => c.value.champion.actual)
</script>

<template>
  <div class="card" v-for="r in rounds" :key="r.key">
    <h2 style="display:flex;justify-content:space-between">
      <span>{{ r.label }}</span><span class="pill">{{ r.ppt }} p / joukkue</span>
    </h2>
    <div v-if="r.set.actual.length" style="margin-bottom:10px">
      <h3>Selvinneet joukkueet</h3>
      <div class="chips"><span v-for="t in r.set.actual" :key="t" class="chip chip--correct">{{ t }}</span></div>
    </div>
    <p v-else class="muted" style="margin-top:0">Ei vielä ratkennut — näytetään veikkaukset.</p>

    <table>
      <thead><tr><th>Nimi</th><th>Veikkaukset</th><th class="num">Pisteet</th></tr></thead>
      <tbody>
        <tr v-for="name in participants" :key="name">
          <td>{{ name }}</td>
          <td>
            <div class="chips">
              <span v-for="team in picksOf(r.key, name)" :key="team" class="chip"
                :class="{ 'chip--correct': isCorrect(r.set, name, team) }">{{ team }}</span>
            </div>
          </td>
          <td class="num"><span class="points" :class="{ zero: r.set.points[name] === 0 }">{{ r.set.points[name] }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2 style="display:flex;justify-content:space-between"><span>Mestari</span><span class="pill">12 p</span></h2>
    <p v-if="championActual" style="margin-top:0">Mestari: <strong class="points">{{ championActual }}</strong></p>
    <p v-else class="muted" style="margin-top:0">Ei vielä ratkennut.</p>
    <table>
      <thead><tr><th>Nimi</th><th>Veikkaus</th><th class="num">Pisteet</th></tr></thead>
      <tbody>
        <tr v-for="name in participants" :key="name">
          <td>{{ name }}</td>
          <td>
            <span class="chip" :class="{ 'chip--correct': championActual && store.bets!.knockout.champion.picks[name] === championActual }">
              {{ store.bets!.knockout.champion.picks[name] }}
            </span>
          </td>
          <td class="num"><span class="points" :class="{ zero: c.champion.points[name] === 0 }">{{ c.champion.points[name] }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
