# NEXUS

Ibrahim's personal operating system — five specialized apps, one cohesive interface, zero subscriptions, zero frameworks.

Everything runs in the browser. Data lives in `localStorage` first (instant, offline-first), and optionally mirrors to a Supabase cloud database so phone and laptop stay in sync within about a second of each other. No build step, no `npm install`, no bundler. Drop the folder on any static host and it works.

---

## The Five Apps

### 🎯 Goals — `index.html`
The command center and home screen. A circular day-progress energy ring tracks your waking hours — wake and sleep times are now user-configurable via a gear button (saved to localStorage, no longer hardcoded). Below it, a long-term goals tracker lets you add goals with a title, current value, target value, unit, and direction (going up = savings/reps, going down = weight loss). Progress percentage and bar auto-calculate from the numbers. You can update the current value inline at any time. The old today's goals card, tomorrow's goals card, rollover logic, goal ticker, and streak system have been removed — the dashboard is now focused on long-term progress only.

### 💊 Health Stack — `health.html`
Morning / lunch / evening / anytime windows for every supplement. Missed doses pulse red after their cutoff hour. Running-low items get flagged. Searchable supplement database with 70+ entries (pre-fills dose, timing, and notes). Inline editing of name and dose/note fields. Resets at 6 AM daily. Currently kept as-is; a replacement is being considered.

### 🏋️ Summer Grind Gym — `gym.html`
4-day push/pull/legs/core split (Mon–Thu) with per-exercise checkoffs. Key updates in this version:

- **Mark as missed** — a dedicated `✕ Mark missed` button sits alongside `Mark workout done`. They're mutually exclusive: marking one clears the other. Both write to the session history.
- **Consistency chart** — 8-week bar chart (Chart.js) showing weekly workout completion percentage. Green = all scheduled days done, teal = partial, red = missed. Displays this-month % and current streak at the top.
- **Heatmap calendar** — 16-week GitHub-style contribution grid. Each cell is a day: green = done, red = missed, gray = rest, dark = no data. Hover any cell for the date. Stats row shows total done, total missed, best streak.
- **Planche progression** — 4-phase tracker (Lean → Tuck → Advanced Tuck → Full) with Mon/Thu hold-time logging per week, delta tracking, and a progress bar per phase.
- **Weight tracker** — bodyweight log with a trend line chart, 7-day delta, and a progress bar from start (185 lbs) to goal (175 lbs).
- **Daily nutrition log** — calories, protein, steps, energy level, food eaten, notes. Target pills auto-highlight green/red vs. goals (1900–2100 kcal, 130–150g protein, 10k steps).
- The fake muscle rank/LP card has been removed and replaced with the above charts.

### ⚡ Grind Log — `grind-log.html`
Gamified productivity tracker. Log tasks across six categories: Code, Study, Fitness, Content, Focus, Other. Each has preset quick-log tasks (e.g. "Built a feature +75 XP", "TryHackMe room +60 XP"). Manual entry with custom XP. Seven-tier rank ladder: Rookie → Grinder → Hustler → Focused → Elite → Ascendant → Legend. 14-day XP bar chart, category breakdown, recent activity log, streak counter, best-day stat. XP is cumulative across all time.

### 🏹 Valorant Command Center — `valorant-cc.html`
Full match-history tracker for ranked grinding. Log agent, map, KDA, headshot %, result (win/loss/draw), RR change, score, rank, and notes per session. Auto-updates the RR tracker when you log a session with an RR change. Stats: win rate, avg KDA, avg HS%, best map, most played agent, session count. Win/loss streak banner (fires at 2+ consecutive). Agent and map win-rate breakdowns with mini bar charts. 14-day W/L bar chart. Manual RR entry with a progress bar toward Immortal.

---

## Architecture

**Zero-dependency core.** Vanilla JavaScript, CSS3, HTML5. Every page opens directly in a browser with no compilation.

**Local-first storage.** All reads and writes hit `localStorage` first. `sync.js` watches a whitelisted set of keys per app and pushes debounced updates to Supabase in the background. On load, it pulls remote state and merges it. Real-time sync is handled via Supabase postgres_changes subscription.

**Shared chrome — `topbar.js`.** A sticky status bar injected on every page showing live counts for all five apps: goals complete, supplements taken, gym status (done/missed/rest), XP earned today, and Valorant W/L. Tapping any pill navigates there. Also registers the service worker for PWA offline support.

**PWA — `manifest.json` + `sw.js`.** Fully installable on iOS (Safari → Add to Home Screen) and Android. Launches full-screen with no browser chrome. Service worker uses network-first for HTML pages and stale-while-revalidate for static assets.

**Aurora glass aesthetic.** Deep space background (`#02020C`) with layered indigo/violet/cyan radial glows, frosted `backdrop-filter` panels, tabular monospace numbers so stats never jitter on update, consistent CSS variable system across all pages (`--indigo`, `--cyan`, `--violet`, `--surface`, `--border`, etc.).

---

## File Structure

```
nexus/
├── index.html          — Goals + energy ring (home screen)
├── health.html         — Supplement stack tracker
├── gym.html            — Workout tracker + charts + planche
├── grind-log.html      — XP productivity tracker
├── valorant-cc.html    — Match history + RR tracker
├── sync.js             — Supabase cloud sync helper (shared)
├── topbar.js           — Persistent nav bar + PWA service worker reg (shared)
├── sw.js               — Service worker (offline cache)
├── manifest.json       — PWA manifest
├── favicon-32.png
├── icon-192.png
├── icon-512.png
└── apple-touch-icon-180.png
```

---

## Storage Keys

Each app writes to a specific set of localStorage keys. `sync.js` syncs these per app.

| App | Keys synced |
|---|---|
| Goals | `long_goals_v1`, `day_window_v1` |
| Health | `stack:items`, `stack:version`, `stack:low`, `stack:taken:YYYY-MM-DD` |
| Gym | `ibrahim_gym_v1`, `ibrahim_gym_done` |
| Grind | `grind_log_v1` |
| Valorant | `val_cc_v1` |

---

## Getting Started

### 1. Deploy
Push the folder to GitHub, then import on [Vercel](https://vercel.com) — zero config, it's static files.

### 2. Cloud Sync (optional)
1. Create a free project at [Supabase](https://supabase.com).
2. Create an `app_state` table:
```sql
create table app_state (
  key text primary key,
  data jsonb,
  updated_at timestamptz default now()
);
alter table app_state enable row level security;
create policy "public access" on app_state for all using (true);
```
3. Paste your Supabase project URL and publishable key into `sync.js` and `topbar.js` where indicated.

### 3. Install on iPhone
Open your deployed URL in Safari → Share → **Add to Home Screen**. Launches full-screen, no browser chrome.

---

## Adding a Sixth App

1. Create a new `.html` file using the existing CSS variables (see any page's `:root` block for the full token list).
2. Include the shared scripts:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="sync.js" defer></script>
<script src="topbar.js" defer></script>
```
3. Add an entry to the `TILES` array in `topbar.js` (for the nav pill) and in `index.html` (for the dock tile).
4. Call `initCloudSync({ appKey: 'yourapp', syncedKeys: [...] })` at the bottom of the page.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Language | Vanilla JS (ES2020+), no framework |
| Styling | Pure CSS3, CSS custom properties |
| Charts | Chart.js 4.4 (gym consistency chart only) |
| Database | Supabase (postgres + realtime) |
| Auth | None — single-user, key-based |
| Hosting | Vercel (static) |
| Offline | Service Worker (cache-first assets, network-first HTML) |

---

## Current Status (June 2026)

Active daily use. Recent changes in this session:

- Energy ring wake/sleep times are now configurable per user (gear icon, saves to `day_window_v1`)
- Long-term goals system added to dashboard (replaces daily goals entirely)
- Daily goals, tomorrow's goals, goal ticker, rollover, and streak removed from dashboard
- Gym: missed workout button added (mutually exclusive with done)
- Gym: 8-week consistency bar chart added (Chart.js)
- Gym: 16-week heatmap calendar added
- Gym: fake muscle rank/LP card removed

**Pending / backlog:**
- Replace `health.html` supplement tracker with something new (TBD)
- Decide on health.html replacement direction

---

## License

Open-source. Fork it, gut it, rebuild it as your own.