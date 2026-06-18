<script setup lang="ts">
import { onMounted, onBeforeUnmount, nextTick, ref, shallowRef, computed } from 'vue'
import { store, loadData, startAutoRefresh, stopAutoRefresh } from './store'
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
// Remember each tab's scroll position so switching tabs doesn't carry the page scroll across.
const scrollByTab = new Map<string, number>()
function select(id: string) {
  if (id === active.value) return
  scrollByTab.set(active.value, window.scrollY)
  active.value = id
  current.value = tabs.find((t) => t.id === id)!.comp
  nextTick(() => window.scrollTo(0, scrollByTab.get(id) ?? 0))
}

const updated = computed(() => formatUpdated(store.computed?.lastUpdated ?? null))

// Detect when a newer build is deployed: compare the deployed index.html's hashed asset references
// to the ones this page loaded. (Empty in dev, where there are no hashed assets — so no banner.)
const newVersion = ref(false)
const assetSig = (html: string) => (html.match(/assets\/[A-Za-z0-9_-]+\.js/g) ?? []).sort().join(',')
const currentSig = assetSig(document.documentElement.innerHTML)
async function checkVersion() {
  if (newVersion.value || !currentSig) return
  try {
    const res = await fetch(import.meta.env.BASE_URL, { cache: 'no-cache' })
    if (!res.ok) return
    const sig = assetSig(await res.text())
    if (sig && sig !== currentSig) newVersion.value = true
  } catch { /* ignore — try again next tick */ }
}
const reload = () => location.reload()

function onVisible() {
  if (document.visibilityState !== 'visible') return
  void loadData(true)
  void checkVersion()
}
let versionTimer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  await loadData()
  startAutoRefresh()
  versionTimer = setInterval(checkVersion, 120_000)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)
})
onBeforeUnmount(() => {
  stopAutoRefresh()
  if (versionTimer) clearInterval(versionTimer)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('focus', onVisible)
})
</script>

<template>
  <button v-if="newVersion" class="version-banner" @click="reload">↻ Uusi versio – päivitä</button>

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
