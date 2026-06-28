<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'

const participants = computed(() => store.bets!.participants)
const gb = computed(() => store.computed!.goldenBoot)
// Highest Golden Boot score first; ties keep the original participant order.
const rankedNames = computed(() =>
  [...participants.value].sort((a, b) => gb.value.points[b] - gb.value.points[a]))
</script>

<template>
  <div class="card">
    <h2>Kultakenkä</h2>
    <p class="muted" style="font-size:12.5px;margin-top:0">
      5 maalintekijää / kuponki. 3 p ensimmäisestä maalista, 2 p toisesta, 1 p jokaisesta seuraavasta
      (ei rangaistuspotkukilpailun maaleja, ei omia maaleja). Kielletyt: Mbappé, Kane, Haaland.
    </p>
    <table class="gb-table">
      <thead><tr><th>Nimi</th><th>Maalintekijät (maalit)</th><th class="num">Pisteet</th></tr></thead>
      <tbody>
        <tr v-for="name in rankedNames" :key="name">
          <td class="gb-name">{{ name }}</td>
          <td>
            <div class="chips">
              <span v-for="(l, i) in gb.byName[name]" :key="i" class="chip" :class="{ 'chip--bonus': l.goals > 0 }">
                {{ l.player }} <strong v-if="l.goals > 0">{{ l.goals }}⚽ · {{ l.points }}p</strong>
              </span>
            </div>
          </td>
          <td class="num"><span class="points" :class="{ zero: gb.points[name] === 0 }">{{ gb.points[name] }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* On phones, pin the layout so all three columns stay inside the viewport (the points column can't get
   pushed off-screen); the scorer column takes the remaining width and its chips wrap. On wider screens
   the table lays out automatically, so the "Pisteet" header and the names size to their content. */
@media (max-width: 560px) {
  .gb-table { table-layout: fixed; }
  .gb-table th:nth-child(1) { width: 5.5rem; } /* name */
  .gb-table th:nth-child(3) { width: 5rem; }   /* points — wide enough for the "Pisteet" header */
  .gb-name { overflow-wrap: anywhere; }
  .gb-table .chip { white-space: normal; }     /* let a long scorer chip wrap instead of overflowing */
}
</style>
