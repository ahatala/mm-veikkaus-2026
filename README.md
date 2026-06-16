# MM-Veikkaus 2026 — J&E

A no-backend single-page app that shows the live standings of a friends' World Cup 2026 betting
pool. It replaces a manually-maintained Google Sheet: the bets are ingested once, match results are
pulled automatically from a football API, and all scoring is recomputed in the browser.

**Live:** https://ahatala.github.io/mm-veikkaus-2026/

## How it works

```
scripts/source/veikkaukset.csv   (frozen bets, exported from the sheet)
        │  scripts/ingest-bets.mjs (run once)
        ▼
public/data/bets.json            participants + every pick + tournament metadata
public/data/results.json         match results, standings, knockout, goals  ← updated by the Action
public/data/overrides.json       manual: special-question answers + jury corrections
public/data/maps/*.json          Finnish ↔ API name maps
        │  src/scoring/engine.ts  (pure, unit-tested)
        ▼
        Vue SPA renders leaderboard + breakdowns (src/components/*)
```

The app fetches the three JSON files at runtime and computes everything client-side — there is no
server. The results workflow commits `results.json` and redeploys Pages itself (only when the data
changed). Manual edits to `overrides.json` (pushed as you) redeploy via `deploy.yml`.

## Data updates

`.github/workflows/update-results.yml` runs every 30 min (and on demand). It runs
`scripts/fetch-results.mjs`, which:

- uses **football-data.org** when the repo secret `FOOTBALL_DATA_TOKEN` is set (live, official), or
- falls back to **openfootball/worldcup.json** (no key, ~daily) otherwise.

So it works out of the box with no token; add the token later for live data:

```
gh secret set FOOTBALL_DATA_TOKEN --body "<your token from football-data.org>"
```

### Things only a human can set — `public/data/overrides.json`

```jsonc
{
  "specialAnswers": { "sq1": "Kyllä", "sq5": "Kyllä" },   // resolve the 9 special questions
  "corrections": {                                         // jury (Julle & Dee) overrides; win over the API
    "groupMatches":   { "g12": "1" },                      // force a match sign
    "goldenBootGoals": { "kai havertz": 3 },               // force a player's goals (normalized name key)
    "groupStandings": { "A": ["Meksiko", "Tšekki", "..."] }
  }
}
```

Edit this file (locally or via the GitHub web editor) and commit — the site redeploys automatically.
The special-question ids (`sq1`…`sq9`) and their texts are in `bets.json`.

## Scoring (mirrors the sheet)

| Category | Points |
|---|---|
| Group match 1/X/2 | +1 correct; **+3** if correct *and* < 1/3 of bettors picked that sign |
| Group Top 2 (Kyllä/Ei) | +2 |
| Top 8 / Top 4 / Finalists / Champion | +5 / +6 / +8 / +12 per correct team |
| Golden Boot (5 players) | +3 / +2 / +1,1,… per goal (no shootout/own goals) |
| Special questions | +3 each |

The engine is pinned to the sheet's own computed leaderboard by a regression test
(`src/scoring/engine.test.ts`).

## Develop

```
npm install
npm run dev        # local dev server
npm test           # scoring regression + UI smoke tests
npm run build      # type-check + production build
npm run ingest     # regenerate bets.json from the CSV (one-time)
npm run fetch      # fetch results.json now (openfootball unless FOOTBALL_DATA_TOKEN is set)
```
