<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'

const participants = computed(() => store.bets!.participants)
const gb = computed(() => store.computed!.goldenBoot)
</script>

<template>
  <div class="card">
    <h2>Kultakenkä</h2>
    <p class="muted" style="font-size:12.5px;margin-top:0">
      5 maalintekijää / kuponki. 3 p ensimmäisestä maalista, 2 p toisesta, 1 p jokaisesta seuraavasta
      (ei rangaistuspotkukilpailun maaleja, ei omia maaleja). Kielletyt: Mbappé, Kane, Haaland.
    </p>
    <table>
      <thead><tr><th>Nimi</th><th>Maalintekijät (maalit)</th><th class="num">Pisteet</th></tr></thead>
      <tbody>
        <tr v-for="name in participants" :key="name">
          <td style="white-space:nowrap">{{ name }}</td>
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
