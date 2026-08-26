# NEXUS — Deep Cyber Amethyst

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
