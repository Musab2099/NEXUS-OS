# NEXUS — Deep Cyber Amethyst

<<<<<<< HEAD
> **Private project — all rights reserved.**
>
> NEXUS is Ibrahim's personal operating system. This repository is not open source and is not licensed for reuse, redistribution, modification, or forking without explicit permission.

NEXUS is a local-first progressive web app for goals, wellness, calisthenics training, productivity, and skill progression. It is built with vanilla JavaScript, HTML, and CSS. Data is written to `localStorage` first so the app remains useful offline.

## At A Glance

- **Frontend:** Vanilla JavaScript ES2020+, HTML5, CSS3
- **Storage:** Local browser storage with native cross-tab updates
- **Runtime libraries:** Chart.js 4.4 loaded from jsDelivr for gym charts
- **Offline support:** Service worker with network-first HTML and stale-while-revalidate static assets
- **Build:** Dependency-free Node script that creates `dist/`
- **Tests:** Playwright E2E and visual regression test suite (`tests/`) run via GitHub Actions
- **Visual system:** Deep Cyber Amethyst with a shared vanilla animation layer
- **Hosting:** Vercel or another static host for the generated frontend bundle

## App Suite

| App | Source page | Purpose |
|---|---|---|
| Goals home | `src/pages/index.html` | Energy ring, long-term goals, app dock, and daily highlights |
| Wellness | `src/pages/health.html` | Sleep, habits, recovery, dreams, and journal |
| Gym | `src/pages/gym.html` | Four-day calisthenics training, PRs, charts, nutrition, and measurements |
| Live workout | `src/pages/live-workout.html` | Guided workout session with sets, reps, rest timer, and session saving |
| Grind Log | `src/pages/grind-log.html` | XP-based productivity tracking and category/rank summaries |
| Calisthenics Skills | `src/pages/progression-tab.html` | Planche, handstand, front lever, muscle-up, L-sit, and back lever progressions |

### Wellness

The Wellness page has five tabs: Sleep, Habits, Recovery, Dreams, and Journal. Each module keeps its state in local browser storage and continues to work without a network connection.

### Gym And Live Workout

The Gym page uses a flexible four-day split. The selected weekdays are stored in `gym_schedule_v1`; the first selected day is Day A, the second Day B, and so on. The default is Monday through Thursday.

| Day | Focus |
|---|---|
| A | Push + Planche |
| B | Pull + Front Lever |
| C | Handstand + Core |
| D | Legs + Conditioning |

Gym also includes exercise checklists, rest timers, PR history, consistency charts, training heatmaps, weight tracking, nutrition, and body measurements. `live-workout.html` is the focused session view with set progression, rep controls, rest management, skipping/finishing actions, and local session history.

## Architecture

### Source And Generated Output

```text
NEXUS/
├── public/                      Root-level static assets and icons
├── scripts/                     Build script
├── src/
│   ├── data/                    PWA manifest source
│   ├── pages/                   HTML app pages
│   ├── scripts/                 Browser JavaScript
│   └── styles/                  Shared CSS files
├── supabase/                    Database migrations
├── tests/                       Playwright E2E and visual regression test suite
├── .github/workflows/           GitHub Actions CI workflow (test.yml)
├── sw.js                        Service worker source
├── vercel.json                  Vercel build configuration
└── dist/                        Generated deployable frontend (gitignored)
```

`scripts/build.js` cleans and recreates `dist/`, copies the source folders and browser assets, and places the service worker and manifest at the bundle root. The server-side directories are not part of the public frontend bundle.

### Where To Start

- **Change a feature:** open its matching file in `src/pages/`.
- **Change shared behavior or appearance:** use `src/scripts/` or `src/styles/`.
- **Add a browser asset:** put it in `public/`; the build copies it to the bundle root.
- **Change deployment or offline behavior:** use `vercel.json` or `sw.js`.
- **Verify a change:** use the matching suite in `tests/tests/`; shared selectors live in `tests/tests/helpers.js`.

### Shared Browser Infrastructure

- `src/scripts/topbar.js` — static navigation enhancement, active route highlighting, theme controls, smooth scrolling, and service-worker registration.
- `src/scripts/theme.js` — theme preference handling for the three NEXUS themes.
- `src/scripts/workout-persistence.js` — local-first persistence for active workout sessions.
- `src/scripts/event-horizon.js` — shared circadian tinting and tactile interactions where included.
- `src/scripts/animations.js` — shared vanilla animation runtime for page transitions, card effects, progress feedback, tabs, charts, and rest-timer states.
- `src/styles/animations.css` — shared animation tokens, keyframes, glass-card states, ambient layers, reduced-motion fallbacks, and responsive animation rules.
- `sw.js` — service worker with network-first HTML and stale-while-revalidate static assets.

The animation system uses native DOM APIs and adds no framework or animation dependency. Existing page data and rendering functions remain the source of truth.

### Local Storage Keys

| Area | Key | Contents |
|---|---|---|
| Goals | `long_goals_v1` | Long-term goals |
| Goals | `day_window_v1` | Wake/sleep window |
| Wellness | `wellness:sleep` | Sleep entries |
| Wellness | `wellness:habits` | Habit data |
| Wellness | `wellness:recovery` | Recovery/readiness entries |
| Wellness | `wellness:dreams` | Dream entries |
| Wellness | `wellness:journal` | Wellness journal state |
| Wellness | `wellness:done:YYYY-MM-DD` | Daily completion flags |
| Wellness | `journal:entry:YYYY-MM-DD` | Current daily journal entry |
| Gym | `ibrahim_gym_v1` | Workout, nutrition, weight, and daily gym state |
| Gym | `ibrahim_gym_done` | Completed workouts by date |
| Gym | `gym_pr_v1` | Exercise PR history |
| Gym | `gym_measurements_v1` | Body measurement history |
| Gym | `gym_schedule_v1` | Four selected training weekdays |
| Live workout | `nx-workout-hist` | Saved session history |
| Live workout | `nx-session-snap` | In-progress session snapshot |
| Live workout | `nx-theme` | Live-workout theme |
| Grind | `grind_log_v1` | Productivity tasks and XP |
| Skills | `cali_skills_v1` | Skill levels and session history |
| Theme | `nexus-theme`, `nexus_theme`, `nexus-theme-index` | Theme preferences |

Use the existing page helpers when changing storage behavior. Wrap browser storage access in the page's existing error handling patterns.

## Development

### Requirements

- Node.js 18+
- No install step is required for the core build (tests require Playwright setup in `tests/`)

### Commands

```bash
npm run build       # node scripts/build.js; writes dist/
npm run dev         # build and serve dist/ at http://localhost:3000

# E2E & Visual Regression Tests (from tests/ directory)
cd tests && npm install && npm test
```

A dependency-free preview alternative is:

```bash
node scripts/build.js
python3 -m http.server -d dist 8000
```

## Vercel Configuration

`vercel.json` runs `node scripts/build.js`, publishes `dist/`, and rewrites the app routes to their generated HTML pages. The service worker cache version in `sw.js` must be bumped when the cached file list or static assets change.

## Design System

Deep Cyber Amethyst tokens include `--bg`, `--bg-card`, `--amethyst`, `--indigo`, `--magenta`, and `--violet-muted`. Reuse the existing theme variables and preserve the project's rule against cyan and teal colors in the canonical dark theme.

## Adding An App

1. Add the page under `src/pages/`.
2. Add navigation entries to the static page headers and the home dock when appropriate.
3. Add an explicit storage key prefix and use the existing local-first helpers.
4. Update `sw.js`'s cache list and version if it should work offline.
5. Run `npm run build` and test with `cd tests && npm test`.

## Limitations

- There is no user login; this is a single-user deployment.
- Visual regression tests are automated via Playwright (`tests/tests/visual.spec.js`), though manual checks remain useful for dynamic state transitions.

## License

Private project. All rights reserved. No part of this codebase may be copied, modified, distributed, or used to build derivative works without the author's explicit written permission.
=======
> **⚠️ Private Project — All Rights Reserved**
>
> This is a personal project by Ibrahim. It is **not** open source and is **not** licensed for reuse, redistribution, modification, or forking. Please do not copy, clone, or repurpose this code without explicit permission.

Ibrahim's personal operating system — five specialized apps, one cohesive interface, zero subscriptions, zero frameworks.

Everything runs in the browser. Data lives in `localStorage` first (instant, offline-first), and optionally mirrors to a Supabase cloud database so phone and laptop stay in sync within about a second of each other. No runtime dependencies, no bundler.

---

## Color Scheme — Deep Cyber Amethyst

All CSS custom properties are defined in `src/styles/themes.css` and are consistent across every app.

| Token | Value | Used For |
|---|---|---|
| `--bg` | `#07051A` | Global background |
| `--card` | `rgba(14,10,42,0.48)` | Card surfaces |
| `--border` | `rgba(167,139,250,0.15)` | Card outlines, dividers |
| `--bdr-hov` | `rgba(167,139,250,0.32)` | Active borders, focused inputs |
| `--a1` (`--amethyst`) | `#7C3AED` | Gradient start, primary accent |
| `--a2` (`--indigo`) | `#A78BFA` | Mid-spectrum accent |
| `--a3` (`--magenta`) | `#D946EF` | Gradient end, highlights |
| `--t1` | `#EDE9FE` | Primary text |
| `--t2` | `rgba(212,205,255,0.88)` | Secondary text |
| `--t3` | `rgba(139,126,200,0.78)` | Muted labels |
| `--push` | `#D946EF` | Day A color (Push + Planche) |
| `--pull` | `#A78BFA` | Day B color (Pull + Front Lever) |
| `--legs` | `#7C3AED` | Day C color (Handstand + Core) |
| `--core` | `#5B4E8C` | Day D color (Legs + Conditioning) |

Primary gradient: `linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #D946EF 100%)`

---

## The Five Apps

### 🎯 Goals & Command Center — `src/pages/index.html`
Home screen and command center.

- **Energy ring** — circular day-progress indicator. Fill color interpolates across the amethyst→magenta spectrum as the day progresses. Wake/sleep times are user-configurable via the ⚙ gear button (saved to `day_window_v1`).
- **App dock** — five tiles linking to every app with live stats pulled from `localStorage`.
- **Long-term goals** — add goals with a title, current value, target, unit, and direction (up = savings/reps, down = weight loss). Progress bar auto-calculates. Update current value inline at any time.

---

### 🧘 Wellness Hub — `src/pages/health.html`
Five tabs covering every daily health dimension.

- **😴 Sleep** — log bed time, wake time, and quality (1–5 stars). Auto-calculates duration. 7-day bar chart.
- **✅ Habits** — daily checklist with 6 defaults. Per-habit streak counter with 🔥 at 3+ days. Automatically grants **+25 XP** to Grind Log upon completing all daily habits.
- **⚡ Recovery** — six muscle soreness sliders (0–5), energy and stress ratings (1–5), 0–100 readiness score.
- **🌙 Dreams** — log type, technique, title, description. Tracks total, lucid count, lucid rate.
- **📓 Journal** — seven mood selectors, freeform textarea, autosaves 1.8s after you stop typing. Writes to `journal:entry:YYYY-MM-DD`.

---

### 🏋️ Calisthenics Strength — `src/pages/gym.html`
Four-day calisthenics-focused strength tracker.

- **Flexible 4-day split**:
  - 🔴 Day A: Push + Planche
  - 🔵 Day B: Pull + Front Lever
  - ⚫ Day C: Handstand + Core
  - 🟡 Day D: Legs + Conditioning
- **Rest Timer**: Circular countdown with presets (45/60/90s), warning state, and synthesized Web Audio chime (`880Hz → 1320Hz`) + haptic pulse on finish.
- **Grind XP Synergy**: Marking a workout as Done automatically rewards **+50 XP** to Grind Log.
- **Analytics**: 8-week consistency chart, 16-week training heatmap, weight trendline, nutrition diary, and body measurements.

---

### ⚡ Grind Log — `src/pages/grind-log.html`
Gamified productivity XP tracker.

- Log tasks across 6 categories: Code, Study, Fitness, Content, Focus, Other.
- 14-day XP bar chart with category distribution breakdown.
- Seven-tier rank ladder: Rookie → Grinder → Hustler → Focused → Elite → Ascendant → Legend.
- Real-time event receiver for cross-app XP rewards.

---

### 🤸 Calisthenics Skills — `src/pages/progression-tab.html`
Step-by-step progression tracker for six elite calisthenics skills.

- **Skills tracked**: Planche, Handstand, Front Lever, Muscle-Up, L-Sit, Back Lever.
- Horizontal visual stepper with ✓ (done), → (current), and ○ (locked) states.
- Session logger (hold times, reps, attempts) with sparkline trends and PR tags.

---

## Power Features & Ecosystem Tools

### ⌘K Command Palette
Accessible on any page via `⌘K` (Mac) / `Ctrl+K` (Windows/Linux) or the `COMMAND` button in the topbar.
- Instant jump between all 5 apps.
- Instant theme switcher (Amethyst, Arctic, Peri, Ice).
- Quick actions: Log +30 XP Deep Work, Audio Chime test, 1-Click Backup / Restore.

### 💾 1-Click JSON Backup & Restore
Exposed globally as `window.NEXUS_BACKUP`:
- `window.NEXUS_BACKUP.exportJSON()`: Downloads a timestamped `.json` file of all your personal data.
- `window.NEXUS_BACKUP.importJSON(file)`: Restores your entire OS state instantly.

### 🔔 Web Audio Chime & Haptics Engine
Exposed globally as `window.nexusChime()`:
- Synthesizes a dual-tone crystal bell (`880Hz → 1320Hz`) in pure Web Audio (zero external audio files).
- Triggers tactile vibration patterns on mobile devices.

---

## File Structure

```
nexus/
├── src/
│   ├── pages/
│   │   ├── index.html           — Goals + energy ring (home screen)
│   │   ├── health.html          — Wellness hub (sleep, habits, recovery, dreams, journal)
│   │   ├── gym.html             — Calisthenics strength tracker + charts + schedule
│   │   ├── grind-log.html       — XP productivity tracker
│   │   └── progression-tab.html — Calisthenics skill progressions
│   ├── scripts/
│   │   ├── app.js               — Shared runtime bootloader
│   │   ├── topbar.js            — Persistent HUD, ⌘K palette, chime & backup engines
│   │   ├── sync.js              — Supabase cloud sync helper (shared)
│   │   └── event-horizon.js     — Shared interaction engine
│   ├── styles/
│   │   ├── themes.css           — Theme tokens (Amethyst, Arctic, Peri, Ice)
│   │   ├── event-horizon.css    — Base glassmorphism components
│   │   └── liquid-amethyst.css  — Ambient lighting & glow orbs
│   └── data/
│       └── manifest.json        — PWA manifest
├── scripts/
│   └── build.js                 — Credential injector & dist generator
├── sw.js                        — Service worker (Cache version: nexus-v18)
├── vercel.json                  — Clean route rewrites
├── CLAUDE.md                    — Agent development guide
└── README.md                    — Public documentation
```

---

## Storage Keys

| App | Key | Contents |
|---|---|---|
| Goals | `long_goals_v1` | Array of goal objects |
| Goals | `day_window_v1` | Wake/sleep times for energy ring |
| Wellness | `wellness:habits` | Habit item definitions |
| Wellness | `wellness:done:YYYY-MM-DD` | Array of completed habit IDs |
| Wellness | `wellness:sleep` | Sleep log entries |
| Wellness | `wellness:recovery` | Soreness, energy, stress |
| Wellness | `wellness:dreams` | Dream log entries |
| Wellness | `journal:entry:YYYY-MM-DD` | Daily journal entry |
| Gym | `ibrahim_gym_v1` | Workout logs, exercises, weight, nutrition |
| Gym | `ibrahim_gym_done` | Workouts completed per date map |
| Gym | `gym_pr_v1` | PR history per exercise |
| Gym | `gym_measurements_v1` | Body measurements |
| Gym | `gym_schedule_v1` | 4-day training schedule array |
| Grind | `grind_log_v1` | XP log entries (`{ logs: [{ name, xp, cat, date, ts }] }`) |
| Skills | `cali_skills_v1` | Per-skill level and session history |
| Global | `nexus_theme` | Active theme identifier |

---

## Getting Started

### 1. Build & Local Dev
```bash
npm run build   # = node scripts/build.js
npm run dev     # build + serve dist/
```

### 2. Service Worker Cache
Service worker cache version is currently **`nexus-v18`**.
>>>>>>> 97637ac151207f33462553962126ce48909aa0b4
