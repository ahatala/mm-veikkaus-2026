import { reactive } from 'vue'
import { compute } from './scoring/engine'
import type { Bets, Results, Overrides, Computed } from './scoring/types'

export const store = reactive({
  loading: true,
  error: '',
  bets: null as Bets | null,
  computed: null as Computed | null,
})

// In production read the live data straight from the repo via raw.githubusercontent, which updates the
// instant the results bot commits and bypasses the GitHub Pages CDN — whose ~10 min cache (and
// ignored cache-busting query strings) otherwise left an open tab stale until a manual reload.
// Falls back to the Pages-bundled copy if raw is unreachable. Dev/test use the local files.
const RAW = 'https://raw.githubusercontent.com/ahatala/mm-veikkaus-2026/main/public/data/'
const LOCAL = import.meta.env.BASE_URL + 'data/'

async function fetchJson<T>(baseUrl: string, file: string): Promise<T> {
  const res = await fetch(baseUrl + file, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${file}: ${res.status}`)
  return res.json() as Promise<T>
}
async function getJson<T>(file: string): Promise<T> {
  const primary = import.meta.env.PROD ? RAW : LOCAL
  try {
    return await fetchJson<T>(primary, file)
  } catch (e) {
    if (primary === LOCAL) throw e
    return fetchJson<T>(LOCAL, file) // raw unreachable -> fall back to the Pages copy
  }
}

// silent = background refresh: don't show the loading state or clobber the view on a transient error.
export async function loadData(silent = false): Promise<void> {
  if (!silent) store.loading = true
  store.error = ''
  try {
    const [results, overrides] = await Promise.all([
      getJson<Results>('results.json'),
      getJson<Overrides>('overrides.json'),
    ])
    const bets = store.bets ?? (await getJson<Bets>('bets.json')) // bets are frozen — fetch once
    store.bets = bets
    store.computed = compute(bets, results, overrides)
  } catch (e) {
    if (!silent) store.error = e instanceof Error ? e.message : String(e)
  } finally {
    if (!silent) store.loading = false
  }
}

let refreshTimer: ReturnType<typeof setInterval> | undefined
// Poll for fresh data so an open tab keeps up during matches.
export function startAutoRefresh(ms = 90_000): void {
  stopAutoRefresh()
  refreshTimer = setInterval(() => { void loadData(true) }, ms)
}
export function stopAutoRefresh(): void {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = undefined
}
