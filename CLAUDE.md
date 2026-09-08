# NEXUS-OS — Agent Reference

Personal browser-based OS. Vanilla HTML/CSS/JS, static PWA, deployed on Vercel with Supabase cloud sync. No frameworks. No bundlers (`build.js` is a credential injector + asset copier).

---

## Architecture

```
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
