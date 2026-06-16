// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import App from './App.vue'

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data')

// Serve the real JSON files through a stubbed fetch so we render against actual data.
beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    const path = new URL(url, 'http://x/').pathname.replace(/^\/+/, '').replace(/^data\//, '')
    return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(resolve(DATA, path), 'utf8')) }
  })
})

describe('App renders against live data', () => {
  it('mounts, shows the leaderboard, and switches every tab without errors', async () => {
    const errors: unknown[] = []
    const wrapper = mount(App, { global: { config: { errorHandler: (e) => errors.push(e) } } })
    await flushPromises()

    // Leaderboard (default tab) — render check only; exact totals are pinned by engine.test.ts.
    expect(wrapper.text()).toContain('Tulostaulukko')
    expect(wrapper.text()).toContain('Jone')

    // Click through every tab and ensure each view renders something without throwing.
    const tabs = wrapper.findAll('.tabs button')
    expect(tabs.length).toBe(7)
    for (const tab of tabs) {
      await tab.trigger('click')
      await flushPromises()
      expect(wrapper.find('.card').exists()).toBe(true)
    }
    expect(errors).toEqual([])
  })
})
