<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import type { MatchResult } from '../scoring/types'

const participants = computed(() => store.bets!.participants)

// Group matches by their date label, preserving order.
const byDay = computed(() => {
  const groups: { date: string; matches: MatchResult[] }[] = []
  for (const m of store.computed!.matches) {
    const last = groups[groups.length - 1]
    if (last && last.date === m.match.date) last.matches.push(m)
    else groups.push({ date: m.match.date, matches: [m] })
  }
  return groups
})

function chipClass(m: MatchResult, name: string): string {
  const pick = m.match.picks[name]
  if (!m.actual) return 'chip--pending'
  if (pick !== m.actual) return 'chip--wrong'
  return m.bonus ? 'chip--bonus' : 'chip--correct'
}
</script>

<template>
  <div class="card">
    <h2>Ottelut</h2>
    <div class="legend">
      <span class="chip chip--correct">oikein (+1)</span>
      <span class="chip chip--bonus">oikein + rohkea (+3)</span>
      <span class="chip chip--wrong">väärin</span>
      <span class="chip chip--pending">pelaamatta</span>
    </div>

    <template v-for="day in byDay" :key="day.date">
      <div class="day-head">{{ day.date }}</div>
      <div v-for="m in day.matches" :key="m.match.id" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div class="match-row">
          <span class="muted">{{ m.match.group }} {{ m.match.time }}</span>
          <span class="teams">{{ m.match.home }} – {{ m.match.away }}</span>
          <span>
            <span v-if="m.actual" class="sign" :class="`sign--${m.actual}`">{{ m.actual }}</span>
            <span v-else class="muted">—</span>
          </span>
        </div>
        <div class="chips" style="margin-top:6px">
          <span v-for="name in participants" :key="name" class="chip" :class="chipClass(m, name)">
            {{ name }} <strong>{{ m.match.picks[name] ?? '–' }}</strong>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
