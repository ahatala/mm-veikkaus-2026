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
public/data/results.json         results, standings, decided Top-2, knockout, goals,  ← updated by the Action
                                 auto-resolved special answers
public/data/overrides.json       optional manual jury overrides & corrections
public/data/maps/*.json          Finnish ↔ API name maps
        │  src/scoring/engine.ts  (pure, unit-tested)
        ▼
        Vue SPA renders leaderboard + breakdowns (src/components/*)
```

The app computes everything client-side — there is no server. In production it reads the live JSON
straight from **raw.githubusercontent.com** (the committed files on `main`), which updates the moment
the results bot commits and bypasses the Pages CDN; it falls back to the Pages-bundled copy if raw is
unreachable. A code change still goes through `deploy.yml` (build + Pages deploy); a data change is
just a commit — no rebuild.

## Data updates

`.github/workflows/update-results.yml` runs ~every 10 min (and on demand). It just runs
`scripts/fetch-results.mjs` and commits `results.json` — no build/deploy, since the app reads the data
from raw.githubusercontent. The SPA polls every 90s and on tab focus, and shows an inline live row for
in-play matches (live score + minute, football-data only) with provisional "if it ended now" scoring.
This is near-live (~10-min granularity, set by the cron interval + football-data's free-tier delay),
not a real-time ticker. `fetch-results.mjs`:

- uses **football-data.org** when the repo secret `FOOTBALL_DATA_TOKEN` is set (live, official — it
  **is** set for this repo), or
- falls back to **openfootball/worldcup.json** (no key, ~daily) if the token is missing.

football-data's free top-scorers list is short, so player goals are backfilled from openfootball. To
rotate the token: `gh secret set FOOTBALL_DATA_TOKEN --body "<token>"`.

## Automatic resolution

Everything that can be derived from the feed is resolved **the moment it's mathematically certain** —
no waiting for the round to be played:

- **Knockout teams** (Top 8 / Top 4 / Finalists / Champion) count as soon as a team is slotted into
  that round's fixture, i.e. the instant it wins the previous round.
- **Group winners & exact Top-2 order** resolve early via points-only *clinch* analysis
  (`scripts/clinch.mjs`): when a position can't change regardless of remaining results. Cases that
  depend on goal difference / head-to-head wait for the group to finish (then the real standings are
  used). A Top-2 bet can also flip to "Ei" early once its predicted order becomes impossible.
- **Special questions** (`scripts/specials.mjs`) — all 9 resolve from match/standings/scorer data:
  "Kyllä" the moment it happens, "Ei" only once the deciding phase is fully played. Early-certain
  cases use clinch too (e.g. *Argentina wins group J* the moment it's locked; *≥2 hosts reach the
  knockouts* once two have clinched top-2). Ronaldo/Messi counts open-play goals only.

### Overriding — `public/data/overrides.json`

Special answers are automatic now; this file is only for the **jury (Julle & Dee)** to override or
correct. Anything here wins over the feed.

```jsonc
{
  "specialAnswers": { "sq4": "Kyllä" },                  // override an auto-resolved special question
  "corrections": {
    "groupMatches":   { "g12": "1" },                      // force a match sign
    "goldenBootGoals": { "kai havertz": 3 },               // force a player's goals (normalized name key)
    "groupTop2":      { "A": ["Meksiko", "Tšekki"] },      // force a group's 1st/2nd
    "groupStandings": { "A": ["Meksiko", "Tšekki", "..."] } // force the displayed table
  }
}
```

Edit it (locally or via the GitHub web editor) and commit — the site redeploys automatically. The
special-question ids (`sq1`…`sq9`) and their texts are in `bets.json`.

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
npm test           # scoring regression, clinch + special-question resolvers, UI smoke test
npm run build      # type-check + production build
npm run ingest     # regenerate bets.json from the CSV (one-time)
npm run fetch      # fetch results.json now (openfootball unless FOOTBALL_DATA_TOKEN is set)
```
