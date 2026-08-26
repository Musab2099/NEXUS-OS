# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture

### Build / source separation

```
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
