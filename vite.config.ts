/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages serves the project at https://ahatala.github.io/mm-veikkaus-2026/,
// so the production base must be the repo name. Dev/test stay at "/".
const base = process.env.NODE_ENV === 'production' ? '/mm-veikkaus-2026/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [vue()],
  test: {
    // Scoring engine tests are pure TS — no DOM needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
