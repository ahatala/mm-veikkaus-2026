<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import type { SpecialResult } from '../scoring/types'

const participants = computed(() => store.bets!.participants)
const special = computed(() => store.computed!.special)

function chipClass(s: SpecialResult, name: string): string {
  if (!s.resolved) return 'chip--pending'
  return s.question.picks[name] === s.answer ? 'chip--correct' : 'chip--wrong'
}
</script>

<template>
  <div class="card">
    <h2>Erikoiskysymykset</h2>
    <p class="muted" style="font-size:12.5px;margin-top:0">3 p oikeasta Kyllä/Ei-vastauksesta. Jury (Julle &amp; Dee) ratkaisee tulkinnat.</p>
  </div>

  <div class="card" v-for="s in special" :key="s.question.id">
    <h2 style="font-size:15px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <span>{{ s.question.text }}</span>
      <span class="pill" v-if="!s.resolved">ratkeamatta</span>
      <span class="pill" v-else :style="{ color: 'var(--green)' }">Vastaus: {{ s.answer }}</span>
    </h2>
    <div class="chips">
      <span v-for="name in participants" :key="name" class="chip" :class="chipClass(s, name)">
        {{ name }} <strong>{{ s.question.picks[name] ?? '–' }}</strong>
      </span>
    </div>
  </div>
</template>
