# NEXUS

A unified, local-first personal operating system — five specialized apps, one cohesive interface, zero subscriptions.

NEXUS runs entirely in your browser. It stores everything in `localStorage` for instant, offline-first access, and optionally mirrors that data to a Supabase cloud database so your phone and laptop stay in sync within about a second of each other.

No build step. No framework. No tracking. Just HTML, CSS, and vanilla JavaScript you can read top to bottom.

---

## Why NEXUS

Most personal dashboards either lock your data behind someone else's SaaS or look like a spreadsheet wearing a dark theme. NEXUS is built around two ideas instead:

**Own your data.** Everything lives in your browser first. Cloud sync is optional, additive, and yours — point it at your own Supabase project and nobody else ever touches the database.

**Look like a real product.** The interface uses an aurora-lit "deep space" theme — layered indigo, violet, and cyan glows behind frosted glass panels — instead of a flat dark gray box with text in it.

---

## The Five Apps

### 🎯 Goals & Consistency — `index.html`
The command center. A circular day-progress ring tracks your waking hours, a live ticker scrolls through today's open goals, and a streak counter rewards full-completion days. Undone goals automatically roll into today at 6 AM so nothing slips through.

### 💊 Supplement Stack — `health.html`
Morning / lunch / evening windows for every pill, vitamin, and pre-workout. Missed doses pulse red after their cutoff hour; running-low items get flagged so you reorder before you run out.

### 🏋️ Summer Grind Gym — `gym.html`
A 4-day push/pull/legs/core split with per-exercise checkoffs, a dedicated planche progression tracker (lean → tuck → advanced tuck → full), bodyweight logging with a trend chart, and a daily nutrition log with calorie/protein/step targets.

### ⚡ Grind Log — `grind-log.html`
A gamified productivity tracker. Log tasks across six categories (code, study, fitness, content, focus, other), earn XP, climb a seven-tier rank ladder from Rookie to Legend, and watch a 14-day XP chart and category breakdown build up over time.

### 🏹 Valorant Command Center — `valorant-cc.html`
A full match-history tracker built for ranked grinding: per-session KDA, headshot %, agent and map win-rate breakdowns, an RR tracker with a progress bar toward your rank goal, and a win/loss streak banner that flags hot and cold runs.

---

## Architecture

**Zero-dependency core.** Vanilla JavaScript, CSS3, HTML5 — no `npm install`, no bundler. Every file can be opened directly in a browser or dropped onto any static host.

**Local-first storage.** All reads and writes hit `localStorage` first, so the UI never waits on a network round-trip. `sync.js` watches for changes to a whitelisted set of keys per app and pushes a debounced update to Supabase in the background.

**Shared chrome.** `topbar.js` injects a sticky status bar on every page showing live counts for all five apps (goals done, supplements taken, today's workout status, XP earned, today's W/L) — tap any pill to jump straight there.

**Aurora glass aesthetic.** Deep space background (`#02020C`) with soft indigo/violet/cyan radial glows, frosted `backdrop-filter` panels, and a consistent type system: system font stack for UI text, tabular monospace for every number so stats never jitter when they update.

---

## Getting Started

### 1. Deploy
Push the folder to GitHub, then import it on [Vercel](https://vercel.com) — zero config needed, it's static files.

### 2. Cloud Sync (optional)
1. Create a free project at [Supabase](https://supabase.com).
2. Run the SQL script from `DEPLOYMENT_GUIDE.md` to create the `app_state` table.
3. Paste your project URL and publishable key into `sync.js` and `topbar.js`.

### 3. Add to your iPhone Home Screen
Open your deployed URL in Safari → Share → **Add to Home Screen**. NEXUS launches full-screen with no browser chrome, just like a native app.

---

## Extending NEXUS

To add a sixth app:

1. Create a new `.html` file using the existing aurora/glass CSS variables (`--indigo`, `--cyan`, `--violet`, `--surface`, `--border`, etc. — see any existing page's `:root` block).
2. Include the shared scripts:
   ```html
   <script src="sync.js" defer></script>
   <script src="topbar.js" defer></script>
   ```
3. Register the new app in `topbar.js`'s `TILES` array so it gets a status pill, and in `index.html`'s `TILES` array so it gets a dock tile on the dashboard.
4. Call `initCloudSync({ appKey: 'yourapp', syncedKeys: [...] })` at the bottom of the page if you want it to sync across devices.

---

## License

Open-source. Fork it, gut it, rebuild it as your own.
