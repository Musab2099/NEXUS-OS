# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**NEXUS** — Ibrahim's personal operating system. A zero-dependency, local-first PWA built as a single static folder. Five HTML apps sharing one design system, with optional Supabase cloud sync between devices.

**Stack:** Vanilla JS (ES2020+), CSS3, HTML5. No framework. Drops onto any static host (Vercel recommended).

**External deps loaded at runtime only:**
- `@supabase/supabase-js@2` from jsDelivr (cloud sync)
- Chart.js 4.4 (gym charts only)

## Commands

**There is a build step** — credentials are injected from `.env` at build time so the committed source never contains the real Supabase keys.

```bash
# One-time setup
cp .env.example .env        # then fill in real SUPABASE_URL and SUPABASE_KEY

# Build the deployable bundle into ./dist
npm run build               # = node scripts/build.js

# Local dev: build, then serve dist on http://localhost:3000
npm run dev

# Or skip the npm wrapper — pure Node, no deps
node scripts/build.js
python3 -m http.server -d dist 8000
```

**Bump the service worker cache** — change `CACHE_VERSION` in `sw.js` (currently `nexus-v4`) to force clients to refetch.

**Deploy** — push to a Git remote, import on Vercel. The `vercel.json` at the root tells Vercel to run `node scripts/build.js` and serve from `dist/`. Add the two env vars (`SUPABASE_URL`, `SUPABASE_KEY`) in the Vercel dashboard under **Settings → Environment Variables**.

## Architecture

### Build / source separation

```
/                      ← committed source (no secrets)
├── sync.js            ← contains __SUPABASE_URL__ / __SUPABASE_KEY__ placeholders
├── topbar.js
├── *.html
├── scripts/build.js   ← reads .env, writes dist/
├── .env               ← gitignored, real credentials
├── .env.example       ← committed template
├── vercel.json        ← tells Vercel: build = scripts/build.js, output = dist
└── dist/              ← gitignored, generated build with real values injected
    ├── sync.js        ← real values substituted in
    └── ...
```

Source files use the literal placeholders `__SUPABASE_URL__` and `__SUPABASE_KEY__`. `scripts/build.js` does a string substitution and writes the result to `dist/`. `sync.js` also has a guard that bails (silently disables sync) if it's run with the placeholders still intact, so opening the source files directly in a browser won't crash — sync just won't activate.

### Page map

| File | App | Storage keys (synced → Supabase `app_key`) |
|---|---|---|
| `index.html` | 🎯 Goals home — energy ring, app dock, long-term goals | `goals` → `long_goals_v1`, `day_window_v1` |
| `health.html` | 📓 Wellness hub (Sleep, Habits, Recovery, Dreams, Journal) | `health` → `wellness:sleep`, `wellness:habits`, `wellness:recovery`, `wellness:dreams`, `wellness:journal`, `wellness:done:*` (prefix) |
| `gym.html` | 🏋️ Calisthenics strength — 4-day split, PRs, charts, nutrition | `gym` → `ibrahim_gym_v1`, `ibrahim_gym_done` |
| `grind-log.html` | ⚡ XP productivity tracker | `grind` → `grind_log_v1` |
| `progression-tab.html` | 🤸 Calisthenics skill progressions (Planche, HS, FL, MU, L-Sit, BL) | `calisthenics` → `cali_skills_v1` |

### Shared infrastructure

- **`topbar.js`** — persistent nav injected on every page. Detects phone vs desktop, renders a top bar on desktop and a bottom tab bar on phones (via `topbar--phone` class + body padding). Reads live counts from each app's localStorage and re-renders on `storage`, `focus`, `visibilitychange`, and every 30s. Also registers the service worker.
- **`sync.js`** — `initCloudSync({ appKey, syncedKeys, syncedPrefixes, onApplied })`. Wraps `localStorage.setItem`/`removeItem` to debounce-push (250 ms) whitelisted keys to Supabase `app_state` table. Pulls remote state on load, subscribes to `postgres_changes` for real-time sync, flushes on `beforeunload`/`pagehide`. On applied changes, dispatches `storage` event so the page re-renders (gym/health/grind) or `location.reload()`s (skills — it has no full renderer for remote sessions).
- **`apple-health.js`** — read-only Apple Health cache used by `gym.html`. It first renders `apple_health_metrics_v1` from localStorage, then refreshes the current local date from authenticated same-origin `GET /api/sync-health` when online, using `localStorage.apple_health_sync_token`. Its `runAutoSync()` sanitizes complex metadata before JSON caching and coalesces overlapping refresh triggers into one follow-up pass; it does not upload Apple Health data. Writes are accepted only by the token-protected `POST /api/sync-health` Vercel function. The repository has no persistent Apple Health uploader or cron worker. The app has no login, so keep this deployment single-user until authenticated reads/RLS are added.
- **`api/sync-health.js`** — validates JSON from the iOS Shortcut and routes flat or Health Auto Export v2 records to the server-side writer. `lib/health-validation.js` recursively sanitizes `metadata`; `lib/supabase.js` enforces the same sanitization immediately before every `apple_health_logs` upsert with the server-only `SUPABASE_SERVICE_ROLE_KEY`. Never expose that key in frontend code.
- **`sw.js`** — service worker. Network-first for HTML pages, stale-while-revalidate for static assets. Skips cross-origin (so Supabase works).
- **`event-horizon.js`** + **`event-horizon.css`** — shared interaction engine (circadian tinting, 3D tilt, tactile buttons). Loaded by some pages.
- **`manifest.json`** — PWA manifest, `theme_color` and `background_color` `#02020C`.

### Color system — "Deep Cyber Amethyst"

All CSS variables live in each page's `:root` block. The README has the full token table. Key values:

- `--bg` `#0A0813`, `--bg-card` `#12101F`
- `--amethyst` `#8A2BE2`, `--magenta` `#FF1493`, `--indigo` `#B026FF`
- Primary gradient: `linear-gradient(135deg, #8A2BE2 0%, #B026FF 50%, #FF1493 100%)` — used for all progress fills, rings, sparklines, primary buttons.
- Day A/B/C/D workout colors: `--push` (magenta), `--pull` (indigo), `--legs` (amethyst), `--core` (violet-muted).

**Sweep rule:** no cyan/teal hex codes anywhere — confirm before merging.

### Storage conventions

- All keys are namespaced per app: `wellness:*`, `ibrahim_gym_v1`, `gym_pr_v1`, `gym_measurements_v1`, `gym_schedule_v1`, `grind_log_v1`, `cali_skills_v1`, `long_goals_v1`, `day_window_v1`.
- Date keys use `YYYY-MM-DD` format. Two helpers: `calendarDateKey()` (raw today) and `activeDateKey()` (rolls back before 6am).
- Every page has a `storeGet` / `set` (or `loadX` / `saveX`) helper that JSON-parses with try/catch. Use these instead of touching `localStorage` directly so the sync wrapper fires.
- Cross-page state that needs to be visible in the topbar lives at top-level keys (e.g. `ibrahim_gym_done` is the per-date done map, `ibrahim_habits_v2_days` is the all-done streak map).

### Adding a new app (6th app)

Per the README, the recipe is:
1. New `.html` file. Copy the `:root` block from any existing page.
2. Include the three shared scripts: supabase CDN, `sync.js`, `topbar.js` (all `defer`).
3. Add an entry to the `TILES` array in `topbar.js` (lines 202–293) and to the home-page `TILES` array in `index.html` (lines 1107–1184).
4. Call `initCloudSync({ appKey: 'yourapp', syncedKeys: [...] })` at page bottom.
5. Use the amethyst→magenta gradient for progress and primary actions.
6. If the new app needs more secrets, add them to `.env.example` and to `PLACEHOLDER_FILES` in `scripts/build.js`.

## Things to be careful about

- **`topbar.js` is one shared file across all 5 pages.** Any change affects all pages; the `TILES` array and the `TILES.forEach` in `render()` must stay in sync with the actual app key names in localStorage.
- **Two pages have storage key drift in `topbar.js`** (see Pending in README):
  - The "STACK" tile reads `stack:items` / `ibrahim_habits_v2_days` — `health.html` actually uses `wellness:habits`. The tile may show stale or wrong streak counts until aligned.
  - The "Journal" tile in the home dock reads `journal:entry:YYYY-MM-DD` (correct), but the topbar doesn't surface a journal pill.
- **Gym schedule defaults to Mon–Thu (`[1,2,3,4]`, Sun=0)**. Users can change via ⚙ Schedule; the schedule is stored at `gym_schedule_v1`. The mapping is: first selected day → Day A (Push+Planche), second → Day B (Pull+FL), third → Day C (Handstand+Core), fourth → Day D (Legs+Conditioning).
- **Never commit `.env` or the real credentials** — only the placeholder source. The anon key is publishable by design (RLS is the real gate), but the source should still stay clean. `SUPABASE_SERVICE_ROLE_KEY` and `APPLE_HEALTH_SYNC_TOKEN` are server-only and must never be injected into `dist/` or shared in the Shortcut URL beyond the Authorization header. Apple Health payloads must include a local `workout_date`; use a stable `external_id` when possible so retries are idempotent. The canonical database metadata column is `metadata` (`jsonb`), not `workout_metadata`; sanitize it during validation and again immediately before every Supabase write.
- **No tests, no CI.** Visual regression check is manual: open all 5 pages on phone-sized and desktop viewports, check the topbar layout, exercise the cloud sync by editing the same key in two browser tabs.
- **The Python venv (`.venv/`) is local tooling only** — it contains `nim-claude`, a launcher that starts a LiteLLM proxy for an Nvidia NIM model. Not part of the app; not deployed.
- **After editing any file in the source tree, run `npm run build` before testing locally** — otherwise the page will silently skip sync.
