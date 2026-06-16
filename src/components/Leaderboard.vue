<script setup lang="ts">
import { ref } from 'vue'
import { store } from '../store'
import { CATEGORIES, pts } from '../ui'

const expanded = ref<string | null>(null)
const toggle = (name: string) => { expanded.value = expanded.value === name ? null : name }
const rankClass = (r: number) => (r <= 3 ? `rank--${r}` : '')
</script>

<template>
  <div class="card">
    <h2>Tulostaulukko</h2>
    <table>
      <thead>
        <tr><th style="width:2.5em">#</th><th>Nimi</th><th class="num">Pisteet</th></tr>
      </thead>
      <tbody>
        <template v-for="row in store.computed!.standings" :key="row.name">
          <tr class="expandable" @click="toggle(row.name)">
            <td class="rank" :class="rankClass(row.rank)">{{ row.rank }}</td>
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
      </tbody>
    </table>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Klikkaa pelaajaa nähdäksesi pisteet kategorioittain.</p>
  </div>
</template>
