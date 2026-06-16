import { reactive } from 'vue'
import { compute } from './scoring/engine'
import type { Bets, Results, Overrides, Computed } from './scoring/types'

export const store = reactive({
  loading: true,
  error: '',
  bets: null as Bets | null,
  computed: null as Computed | null,
})

async function getJson<T>(path: string, bust = false): Promise<T> {
  const url = import.meta.env.BASE_URL + path + (bust ? `?v=${Date.now()}` : '')
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json() as Promise<T>
}

// silent = background refresh: don't show the loading state or clobber the view on a transient error.
export async function loadData(silent = false): Promise<void> {
  if (!silent) store.loading = true
  store.error = ''
  try {
    const [bets, results, overrides] = await Promise.all([
      getJson<Bets>('data/bets.json'),
      getJson<Results>('data/results.json', true),
      getJson<Overrides>('data/overrides.json', true),
    ])
    store.bets = bets
    store.computed = compute(bets, results, overrides)
  } catch (e) {
    if (!silent) store.error = e instanceof Error ? e.message : String(e)
  } finally {
    if (!silent) store.loading = false
  }
}

let refreshTimer: ReturnType<typeof setInterval> | undefined
// Poll for fresh data so an open tab keeps up during matches (data refreshes when the Action deploys).
export function startAutoRefresh(ms = 90_000): void {
  stopAutoRefresh()
  refreshTimer = setInterval(() => { void loadData(true) }, ms)
}
export function stopAutoRefresh(): void {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = undefined
}
