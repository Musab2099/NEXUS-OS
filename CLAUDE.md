# NEXUS-OS — Agent Reference

Personal browser-based OS. Vanilla HTML/CSS/JS, static PWA, deployed on Vercel with Supabase cloud sync. No frameworks. No bundlers (`build.js` is a credential injector + asset copier).

<<<<<<< HEAD
## What This Is

**NEXUS** — Ibrahim's personal operating system. A zero-dependency, local-first PWA built as a static folder of HTML/CSS/JS pages sharing a unified design system ("Deep Cyber Amethyst").

**Stack:** Vanilla JS (ES2020+), Vanilla CSS, HTML5. Chart.js 4.4 for gym charts. No frontend framework or bundler. Build step via Node.js script (`node scripts/build.js`) copies source to `dist/`. Hosted on Vercel.

## Commands

```bash
# Build the deployable bundle into ./dist
npm run build               # = node scripts/build.js

# Local dev: build, then serve dist on http://localhost:3000
npm run dev

# Or skip the npm wrapper — pure Node
node scripts/build.js

# Run Playwright E2E and visual regression tests
cd tests && npm test
```

**Bump the service worker cache** — change `CACHE_VERSION` in `sw.js` (currently `nexus-v17`) to force clients to refetch.

**Deploy** — push to Git remote, import on Vercel. The `vercel.json` at root runs `node scripts/build.js` and serves `dist/`.
=======
---
>>>>>>> 97637ac151207f33462553962126ce48909aa0b4

## Architecture

```
<<<<<<< HEAD
/                      ← committed source
├── .github/workflows/ ← GitHub Actions CI workflow (test.yml)
├── scripts/build.js   ← copies src/ -> dist/ and public/* -> dist/ root
├── tests/             ← Playwright E2E & visual regression tests (see tests/TESTING.md)
├── vercel.json        ← tells Vercel: build = scripts/build.js, output = dist
└── dist/              ← gitignored, generated build output
```

### Page map (`src/pages/`)

| File | Purpose | Key Local Storage Keys |
|---|---|---|
| `index.html` | 🎯 Goals home — bento dashboard, Day Ring, Grind, Wellness, Gym, Calisthenics, Highlights, Stats | `long_goals_v1`, `day_window_v1` |
| `health.html` | 📓 Wellness hub — Sleep, Habits, Recovery, Dreams, Journal | `sleep:entry:YYYY-MM-DD`, `wellness:habits`, `recovery:log` |
| `gym.html` | 🏋️ Strength tracker — 4-day split A/B/C/D, PRs, charts, measurements | `ibrahim_gym_v1`, `ibrahim_gym_done`, `gym_schedule_v1` |
| `grind-log.html` | ⚡ XP productivity tracker & goal contributions | `grind_log_v1` |
| `progression-tab.html` | 🤸 Calisthenics skill progressions (Planche, FL, MU, HS, L-Sit, BL) | `cali_skills_v1` |
| `facescan.html` | 🪞 Weekly reflection rating (placeholder for AI face analysis) | `facescan_last_scan` |
| `live-workout.html` | ⏱️ Active workout logger with rest timer | `nexus_workout_YYYY-MM-DD` |
| `offline.html` | 📡 Fallback offline notice | None |

### Shared Infrastructure

- **`src/scripts/topbar.js`** — Enhances the static `<header class="navbar" data-navbar>` on every page. Wires active route highlighting, theme menu toggling, smooth scroll navigation, and registers the service worker. It does NOT inject markup dynamically, has no TILES array, and does not render a bottom tab bar.
- **`src/scripts/theme.js`** — Exposes `window.NexusTheme` (`init`, `set`, `get`). Manages 3 themes: `nexus-dark` (default "Deep Cyber Amethyst"), `arctic-white`, and `periwinkle` ("Focus"). Stored in `localStorage['nexus-theme']`.
- **`src/scripts/animations.js`** — Loaded on every page. Handles ambient orbs, card sheen, 3D tilt, button ripples, Ctrl/Cmd+K command palette, page transitions, and skeleton loaders.
- **`src/scripts/workout-persistence.js`** — Exposes `window.NexusWorkoutStore` for local-first workout logging under `nexus_workout_<date>`.
- **`sw.js`** — Service worker (`CACHE_VERSION = 'nexus-v17'`). Network-first for HTML, stale-while-revalidate for assets.
- **`tests/`** — Playwright E2E and visual regression suite (`smoke`, `navigation`, `themes`, `animations`, `modules`, `pwa`, `visual`). Documented in `tests/TESTING.md` and automated via `.github/workflows/test.yml`.

## Color System & Styling — "Deep Cyber Amethyst"

- All design tokens live in `src/styles/themes.css`.
- Canonical dark theme gradient: `linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #D946EF 100%)` (Amethyst → Violet → Magenta).
- Primary tokens: `--bg`, `--card`, `--card-2`, `--border`, `--t1..t3`, `--a1..a3`, `--ag`, `--push`, `--pull`, `--legs`, `--core`.
- **Sweep Rule:** No cyan/teal hex codes in the canonical dark theme. Cyan legacy aliases exist purely for backward compatibility.

## Local-First Storage & Tabs

- App is **local-first**. All data mutations read and write to `localStorage` wrapped in try/catch blocks (`storeGet`/`storeSet`).
- Updates propagate between tabs natively via the browser `storage` event.

## Header Contract & Logo Branding

Every page HTML file MUST contain the static header element `<header class="navbar" data-navbar>...</header>` with `.nav-link` anchors for topbar.js to bind event listeners and theme controls.

- **Logo Responsive Constraints:** The header logo icon (`.logo-icon img, .logo-icon svg, .logo-container img, .logo-container svg`) utilizes `height: clamp(1.5rem, 3vw, 2.25rem); width: auto; object-fit: contain; flex-shrink: 0;` to ensure fluid auto-scaling while maintaining its natural aspect ratio without warping.
- **GitHub Header Link:** The GitHub header action component is retained in the DOM markup across pages but visually hidden using CSS `style="display: none !important;"` so it can be re-enabled without altering HTML structure.
=======
nexus-os/
├── src/
│   ├── pages/
│   │   ├── index.html           # Dashboard / home / energy ring
│   │   ├── health.html          # Wellness & habit tracker (Sleep, Habits, Recovery, Dreams, Journal)
│   │   ├── gym.html             # Calisthenics strength tracker + rest timer
│   │   ├── grind-log.html       # XP / productivity log
│   │   └── progression-tab.html # Calisthenics skill progressions
│   ├── scripts/
│   │   ├── app.js               # Core OS bootstrap & early theme initialization
│   │   ├── topbar.js            # Global topbar, live tile data, ⌘K palette, chime & backup engines
│   │   ├── sync.js              # Supabase sync logic (credentials injected at build)
│   │   └── event-horizon.js     # Shared interaction engine
│   ├── styles/
│   │   ├── themes.css           # CSS custom property token definitions (amethyst, arctic, peri, ice)
│   │   ├── event-horizon.css    # Global base styles + glassmorphism components
│   │   └── liquid-amethyst.css  # Ambient glass & orb styling
│   └── data/
│       └── manifest.json        # PWA manifest
├── scripts/
│   └── build.js                 # Injects __SUPABASE_URL__ + __SUPABASE_KEY__ into sync.js, copies assets to dist/, builds root index.html
├── dist/                        # Build output (gitignored or Vercel-served)
├── sw.js                        # Service worker — current version: nexus-v18
├── vercel.json                  # Routing config & clean rewrites
├── CLAUDE.md                    # This file
└── README.md                    # Public documentation
```

---

## Build System

```bash
npm run build   # → node scripts/build.js
```

`build.js` does:
1. Replaces `__SUPABASE_URL__` and `__SUPABASE_KEY__` placeholders in `src/scripts/sync.js`.
2. Copies all active pages, scripts, styles, data, and public assets to `dist/`.
3. Generates `dist/index.html` root entry point / redirect to `src/pages/index.html`.

---

## Service Worker

**Current version: `nexus-v18`**

When modifying `sw.js`, always increment the version (`nexus-v19`, etc.).
Static asset manifest in `sw.js` caches:
- All 5 pages in `src/pages/`
- All scripts in `src/scripts/`
- `src/styles/themes.css`, `event-horizon.css`, `liquid-amethyst.css`
- `src/data/manifest.json`, public icons

---

## Design System — Liquid Amethyst

**Aesthetic:** Deep Cyber Amethyst glassmorphism. Dark backgrounds, semi-transparent layered cards, purple/violet accent palette, blurred glow orbs as background animation.

### Themes (Verified)

| Theme | Key | Notes |
|-------|-----|-------|
| Amethyst | `amethyst` | Default. Deep cyber amethyst, near-black bg (`#07051A`) |
| Arctic White | `arctic` | Clean crisp light mode variant (`#EEF5FF`) |
| Periwinkle | `peri` | Soft purple-blue mid-tone (`#0D1030`) |
| Ice | `ice` | Cool cyan-tinted light theme (`#F0F9FF`) |

### Token Rules

All colors must use CSS custom properties defined in `themes.css`.
**Banned tokens:** `--cyan` (`#22D3EE`) in Amethyst mode — strictly mapped to `#B026FF`, `#D946EF`, or `#8A2BE2`.

---

## LocalStorage Schema

| Key | Owner | Contents |
|-----|-------|----------|
| `ibrahim_gym_v1` | gym.html | Workout state, exercises checked, nutrition, weight, body measurements |
| `ibrahim_gym_done` | gym.html | Map of workout completions by date (`{ 'YYYY-MM-DD': 1 }`) |
| `gym_pr_v1` | gym.html | Exercise PR history |
| `gym_measurements_v1` | gym.html | Measurement history |
| `gym_schedule_v1` | gym.html | Training day array (4 days of week) |
| `wellness:habits` | health.html | Array of habit definitions (`[{ id, icon, name }, ...]`) |
| `wellness:done:YYYY-MM-DD` | health.html | Array of completed habit IDs for the date |
| `wellness:sleep` | health.html | Sleep logs |
| `wellness:recovery` | health.html | Muscle soreness, energy, stress |
| `wellness:dreams` | health.html | Dream logs |
| `journal:entry:YYYY-MM-DD` | health.html | Daily journal entry |
| `grind_log_v1` | grind-log.html | `{ logs: [{ name: string, xp: number, cat: string, date: string, ts: number }] }` |
| `cali_skills_v1` | progression-tab.html | `{ [skill]: { level: number, sessions: [{ date, value, unit, level, note }] } }` |
| `long_goals_v1` | index.html | Long-term goal definitions |
| `day_window_v1` | index.html | Wake/sleep times for energy ring |
| `nexus_theme` | topbar.js | Active theme identifier (`amethyst`, `arctic`, `peri`, `ice`) |

---

## Shared Capabilities

### ⌘K Command Palette (`topbar.js`)

Triggered by `Meta+K` / `Ctrl+K` or topbar `COMMAND` button. Glassmorphism overlay search & action launcher.
- **Navigation:** Switch between all 5 apps.
- **Themes:** Quick-switch between Amethyst, Arctic, Peri, Ice.
- **Quick Actions:**
  - `Log 30 XP Deep Work`
  - `Audio Chime & Haptics Test`
  - `Export All Data (JSON)`
  - `Import Data from JSON File`

### Backup / Restore Engine (`topbar.js`)

`window.NEXUS_BACKUP` — globally accessible object:
- `NEXUS_BACKUP.exportJSON()` → bundles all NEXUS keys into a JSON blob, triggers download `nexus-backup-YYYY-MM-DD.json`.
- `NEXUS_BACKUP.importJSON(jsonString)` → parses, validates, writes to localStorage, and fires storage event.

### Web Audio Chime & Haptics (`topbar.js`)

`window.nexusChime()`: Synthesizes a dual-tone crystal bell (`880Hz → 1320Hz`) with zero external assets, paired with `navigator.vibrate([80, 40, 100])`.

### Cross-App XP Synergy

- **Habits → Grind:** When all daily habits in `health.html` are completed, automatically awards `+25 XP` (`focus` category) to `grind_log_v1` and chimes.
- **Workout → Grind:** When a workout in `gym.html` is marked Done, automatically awards `+50 XP` (`fitness` category) to `grind_log_v1` and chimes.

---

## Routing (`vercel.json`)

```json
{
  "buildCommand": "node scripts/build.js",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/",        "destination": "/src/pages/index.html" },
    { "source": "/health",  "destination": "/src/pages/health.html" },
    { "source": "/gym",     "destination": "/src/pages/gym.html" },
    { "source": "/grind",   "destination": "/src/pages/grind-log.html" },
    { "source": "/skills",  "destination": "/src/pages/progression-tab.html" }
  ]
}
```
>>>>>>> 97637ac151207f33462553962126ce48909aa0b4
