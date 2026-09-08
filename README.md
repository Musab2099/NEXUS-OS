# NEXUS — Deep Cyber Amethyst

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
