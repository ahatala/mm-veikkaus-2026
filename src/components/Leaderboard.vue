<script setup lang="ts">
import { ref, computed } from 'vue'
import { store } from '../store'
import { CATEGORIES, pts } from '../ui'
import { PLAYER_META, type Age, type Gender } from '../playerMeta'

const expanded = ref<string | null>(null)
const toggle = (name: string) => { expanded.value = expanded.value === name ? null : name }
const rankClass = (r: number) => (r <= 3 ? `rank--${r}` : '')

// --- optional filters (hidden by default) ---
const showFilters = ref(false)
const ageFilter = ref<'all' | Age>('all')
const genderFilter = ref<'all' | Gender>('all')
const filtering = computed(() => ageFilter.value !== 'all' || genderFilter.value !== 'all')
const reset = () => { ageFilter.value = 'all'; genderFilter.value = 'all' }

const rows = computed(() => {
  const all = store.computed!.standings
  if (!filtering.value) return all.map((r) => ({ ...r, pos: r.rank }))
  return all
    .filter((r) => {
      const m = PLAYER_META[r.name]
      if (!m) return false
      return (ageFilter.value === 'all' || m.age === ageFilter.value) &&
        (genderFilter.value === 'all' || m.gender === genderFilter.value)
    })
    .map((r, i) => ({ ...r, pos: i + 1 })) // re-rank within the filtered group
})
</script>

<template>
  <div class="card">
    <div class="head">
      <h2>Tulostaulukko</h2>
      <button class="filter-toggle" :class="{ on: filtering }" @click="showFilters = !showFilters">
        Suodata{{ filtering ? ` · ${rows.length}/${store.computed!.standings.length}` : '' }} {{ showFilters ? '▴' : '▾' }}
      </button>
    </div>

    <div v-if="showFilters" class="filters">
      <div class="frow">
        <span class="flabel">Ikä</span>
        <div class="seg">
          <button :class="{ on: ageFilter === 'all' }" @click="ageFilter = 'all'">Kaikki</button>
          <button :class="{ on: ageFilter === 'adult' }" @click="ageFilter = 'adult'">Aikuiset</button>
          <button :class="{ on: ageFilter === 'kid' }" @click="ageFilter = 'kid'">Lapset</button>
        </div>
      </div>
      <div class="frow">
        <span class="flabel">Sukupuoli</span>
        <div class="seg">
          <button :class="{ on: genderFilter === 'all' }" @click="genderFilter = 'all'">Kaikki</button>
          <button :class="{ on: genderFilter === 'm' }" @click="genderFilter = 'm'">Miehet</button>
          <button :class="{ on: genderFilter === 'f' }" @click="genderFilter = 'f'">Naiset</button>
        </div>
      </div>
      <button v-if="filtering" class="reset" @click="reset">Tyhjennä suodattimet</button>
    </div>

    <table>
      <thead>
        <tr><th style="width:2.5em">#</th><th>Nimi</th><th class="num">Pisteet</th></tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="row.name">
          <tr class="expandable" @click="toggle(row.name)">
            <td class="rank" :class="rankClass(row.pos)">{{ row.pos }}</td>
            <td>{{ row.name }}</td>
            <td class="num"><strong>{{ row.total }}</strong></td>
          </tr>
          <tr v-if="expanded === row.name" class="breakdown">
            <td></td>
            <td colspan="2">
              <div class="breakdown-grid">
                <div class="row" v-for="c in CATEGORIES" :key="c.key">
                  <span class="lbl">{{ c.label }}</span>
                  <span class="points" :class="{ zero: row.breakdown[c.key] === 0 }">{{ pts(row.breakdown[c.key]) }}</span>
                </div>
              </div>
            </td>
          </tr>
        </template>
        <tr v-if="!rows.length"><td colspan="3" class="muted center" style="padding:18px">Ei pelaajia näillä suodattimilla.</td></tr>
      </tbody>
    </table>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Klikkaa pelaajaa nähdäksesi pisteet kategorioittain.</p>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.head h2 { margin: 0; }
.filter-toggle {
  font: inherit; font-size: 12.5px; cursor: pointer;
  background: var(--bg-elev2); color: var(--muted);
  border: 1px solid var(--line); border-radius: 999px; padding: 5px 11px;
}
.filter-toggle:hover { color: var(--text); }
.filter-toggle.on { background: var(--accent2); color: #0b1020; border-color: var(--accent2); font-weight: 600; }

.filters {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px; margin-bottom: 12px;
  background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
}
.frow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.flabel { font-size: 12px; color: var(--muted); width: 78px; flex: none; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
.seg button {
  font: inherit; font-size: 12.5px; cursor: pointer;
  background: transparent; color: var(--muted); border: none; padding: 6px 12px;
}
.seg button + button { border-left: 1px solid var(--line); }
.seg button.on { background: var(--accent2); color: #0b1020; font-weight: 600; }
.reset { font: inherit; font-size: 12px; background: none; border: none; color: var(--accent); cursor: pointer; padding: 0; text-align: left; }
</style>
