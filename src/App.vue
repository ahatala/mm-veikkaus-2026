<script setup lang="ts">
import { onMounted, ref, shallowRef, computed } from 'vue'
import { store, loadData } from './store'
import { formatUpdated } from './ui'
import Leaderboard from './components/Leaderboard.vue'
import PlayerDetail from './components/PlayerDetail.vue'
import Matches from './components/Matches.vue'
import Groups from './components/Groups.vue'
import Bracket from './components/Bracket.vue'
import GoldenBoot from './components/GoldenBoot.vue'
import Special from './components/Special.vue'

const tabs = [
  { id: 'leaderboard', label: 'Tulostaulukko', comp: Leaderboard },
  { id: 'player', label: 'Pelaajan erittely', comp: PlayerDetail },
  { id: 'matches', label: 'Ottelut', comp: Matches },
  { id: 'groups', label: 'Lohkot / Top 2', comp: Groups },
  { id: 'bracket', label: 'Pudotuspelit', comp: Bracket },
  { id: 'golden', label: 'Kultakenkä', comp: GoldenBoot },
  { id: 'special', label: 'Erikoiskysymykset', comp: Special },
]
const active = ref(tabs[0].id)
const current = shallowRef(tabs[0].comp)
function select(id: string) {
  active.value = id
  current.value = tabs.find((t) => t.id === id)!.comp
}

const updated = computed(() => formatUpdated(store.computed?.lastUpdated ?? null))

onMounted(loadData)
</script>

<template>
  <header class="app-header">
    <h1>MM-Veikkaus 2026 — J&amp;E</h1>
    <div class="sub">Päivitetty: {{ updated }}</div>
    <div class="rules-summary">
      <span><b>Panos</b> 15 € / kuponki</span>
      <span><b>Voitonjako</b> 80 % / 20 % (voittaja lahjoittaa 10 % hyväntekeväisyyteen)</span>
      <span><b>Jury</b> Julle &amp; Dee</span>
      <span>Ajat Suomen aikaa (EEST)</span>
    </div>
  </header>

  <nav class="tabs">
    <button
      v-for="t in tabs" :key="t.id"
      :class="{ active: active === t.id }"
      @click="select(t.id)"
    >{{ t.label }}</button>
  </nav>

  <main>
    <div v-if="store.loading" class="state">Ladataan…</div>
    <div v-else-if="store.error" class="state error">Virhe ladattaessa tietoja: {{ store.error }}</div>
    <component v-else-if="store.computed && store.bets" :is="current" />
  </main>
</template>
