# NEXUS — Deep Cyber Amethyst

> **⚠️ Private Project — All Rights Reserved**
>
> This is a personal project by Ibrahim. It is **not** open source and is **not** licensed for reuse, redistribution, modification, or forking. Please do not copy, clone, or repurpose this code without explicit permission.

Ibrahim's personal operating system — five specialized apps, one cohesive interface, zero subscriptions, zero frameworks.

Everything runs in the browser. Data lives in `localStorage` first (instant, offline-first), and optionally mirrors to a Supabase cloud database so phone and laptop stay in sync within about a second of each other. No build step, no `npm install`, no bundler. Drop the folder on any static host and it works.

---

## Color Scheme — Deep Cyber Amethyst

All CSS custom properties are defined in each page's `:root` block and are consistent across every file.

| Token | Value | Used For |
|---|---|---|
| `--bg` | `#0A0813` | Global background |
| `--bg-card` | `#12101F` | Card surfaces |
| `--border` | `rgba(138,43,226,0.18)` | Card outlines, dividers |
| `--border-strong` | `rgba(138,43,226,0.40)` | Active borders, focused inputs |
| `--amethyst` | `#8A2BE2` | Gradient start, primary accent |
| `--magenta` | `#FF1493` | Gradient end, highlights |
| `--indigo` | `#B026FF` | Mid-spectrum accent |
| `--violet-muted` | `#6B4FA0` | Secondary, HIIT badge, rest cells |
| `--gray-rest` | `#4A445E` | Rest timer warning state |
| `--text-1` | `#FFFFFF` | Primary text |
| `--text-2` | `#D4CFE5` | Secondary text |
| `--text-3` | `#8A7FA8` | Muted labels |
| `--text-4` | `#5A4E78` | Disabled / placeholder |
| `--push` | `#FF1493` | Day A color (Push + Planche) |
| `--pull` | `#B026FF` | Day B color (Pull + Front Lever) |
| `--legs` | `#8A2BE2` | Day C color (Handstand + Core) |
| `--core` | `#6B4FA0` | Day D color (Legs + Conditioning) |
| `--font` | system-ui stack | Body text |
| `--mono` | ui-monospace stack | Stats, labels, inputs |

Primary gradient: `linear-gradient(135deg, #8A2BE2 0%, #B026FF 50%, #FF1493 100%)`

Progress fills, rings, sparklines, and CTA buttons all use this gradient. The aurora background uses radial blurs at 20–22% opacity to keep it subtle.

---

## The Five Apps

### 🎯 Goals — `index.html`
Home screen and command center.

- **Energy ring** — circular day-progress indicator. Fill color interpolates across the amethyst→magenta spectrum as the day progresses. Wake/sleep times are user-configurable via the ⚙ gear button (saved to `day_window_v1`). Phases: Morning → Midday → Afternoon → Evening → Bedtime.
- **App dock** — five tiles linking to every app with live stats pulled from `localStorage`. The SKILLS tile shows skills active count and average progression %.
- **Long-term goals** — add goals with a title, current value, target, unit, and direction (up = savings/reps, down = weight loss). Progress bar auto-calculates. Update current value inline at any time.

---

### 🧘 Wellness Hub — `health.html`
Five tabs covering every daily health dimension.

- **😴 Sleep** — log bed time, wake time, and quality (1–5 stars). Auto-calculates duration. 7-day bar chart. Stats: last night, 7-day average, 7h+ streak.
- **✅ Habits** — daily checklist with 6 defaults. Per-habit streak counter with 🔥 at 3+ days. Resets at midnight.
- **⚡ Recovery** — six muscle soreness sliders (0–5), energy and stress ratings (1–5), 0–100 readiness score. SVG ring animates to score.
- **🌙 Dreams** — log type, technique, title, description. Tracks total, lucid count, lucid rate.
- **📓 Journal** — seven mood selectors, freeform textarea, autosaves 1.8s after you stop typing. Writes to `journal:entry:YYYY-MM-DD`.

---

### 🏋️ Calisthenics Strength — `gym.html`
Four-day calisthenics-focused strength tracker. Equipment: pull-up bar + 10 lb dumbbells.

**Flexible scheduling** — tap ⚙ Schedule to pick any 4 days of the week. Days A/B/C/D map to whichever days you choose. Saved to `gym_schedule_v1`. Default: Mon–Thu.

**4-day split:**

| Day | Focus | Key Skill Work |
|---|---|---|
| 🔴 A | Push + Planche | Planche lean, pseudo planche push-ups, pike push-ups, diamond push-ups, DB shoulder/lateral raise |
| 🔵 B | Pull + Front Lever | Dead hang, scapular pull-ups, pull-up negatives, tuck front lever hold, DB row/curl, hollow body |
| ⚫ C | Handstand + Core | Wall handstand, freestanding kick-up practice, L-sit hold, hollow body, V-up, ab wheel, Russian twists |
| 🟡 D | Legs + Conditioning | Bulgarian split squats, jump squats, RDL, glute bridges, calf raises, explosive pull-ups (muscle-up prep), HIIT burpees + mountain climbers |

**Features:**
- Exercise checklist with tap-to-check. Fires rest timer automatically on each check (45/60/90s presets).
- PR history modal per exercise — value, unit, note, sparkline trend, best tag.
- Mark workout done or missed. Both feed the heatmap and consistency chart.
- **8-week consistency chart** (Chart.js) — bars fill amethyst→magenta for 100%, indigo for partial, obsidian for missed.
- **16-week training heatmap** — done cells deep purple, missed cells obsidian-plum, rest cells muted violet.
- **Weight tracker** — trend line chart, 7-day delta, progress bar toward 175 lb goal.
- **Nutrition log** — calories, protein, steps, energy level, food diary. Target pills highlight when goals are hit.
- **Body measurements** — arms, chest, waist in inches. Delta tracking vs. previous entry.
- **Skills CTA** — links directly to the calisthenics progression tracker.

---

### ⚡ Grind Log — `grind-log.html`
Gamified productivity XP tracker.

Log tasks across 6 categories: Code, Study, Fitness, Content, Focus, Other. 14-day XP bar chart. Category breakdown in pill badges. Seven-tier rank ladder: Rookie → Grinder → Hustler → Focused → Elite → Ascendant → Legend. XP is cumulative across all time.

---

### 🤸 Calisthenics Skills — `valorant-cc.html`
Step-by-step progression tracker for six elite calisthenics skills.

**Skills tracked:**

| Skill | Emoji | Levels | Unit |
|---|---|---|---|
| Planche | 🎯 | 5 | sec |
| Handstand | 🤸 | 6 | sec / reps |
| Front Lever | 🏗️ | 6 | sec |
| Muscle-Up | 💪 | 5 | reps |
| L-Sit | 🪑 | 5 | sec |
| Back Lever | ⬇️ | 5 | sec / reps |

**Progression levels — Planche:**
Planche Lean → Tuck Planche → Advanced Tuck → Straddle Planche → Full Planche

**Progression levels — Handstand:**
Chest-to-Wall → Back-to-Wall → Kick-up Practice → Freestanding HS → Wall HS Push-up → Freestanding HSPU

**Progression levels — Front Lever:**
Dead Hang → Scapular Pull-ups → Tuck FL → Advanced Tuck FL → Straddle FL → Full Front Lever

**Progression levels — Muscle-Up:**
High Pull-ups → Explosive Pull-ups → Negative Muscle-Ups → Kipping MU → Strict Muscle-Up

**Progression levels — L-Sit:**
Floor Support Hold → Tuck L-Sit → L-Sit (Floor/DBs) → Elevated L-Sit → V-Sit

**Progression levels — Back Lever:**
Skin the Cat → Tuck Back Lever → Advanced Tuck BL → Straddle BL → Full Back Lever

**Per-skill features:**
- **Overview grid** — 6 cards at top showing current level name and % progress bar for every skill at a glance.
- **Skill tabs** — switch between skills instantly.
- **Progression ladder** — horizontal visual stepper with ✓ (done), → (current), ○ (locked) states. Click any step to preview that level.
- **Level guide card** — sets/reps target, 5 technique cues, and exact "progress when" criteria.
- **Set as Current** — mark your actual working level at any time.
- **Session logger** — log hold time (sec), reps, or attempts with optional notes.
- **Sparkline** + last 10 sessions with best-PR tag and delete button.

Data stored in `cali_skills_v1`.

---

## Architecture

**Zero-dependency core.** Vanilla JavaScript (ES2020+), CSS3, HTML5. Every page opens directly in a browser — no compilation, no bundler, no Node required.

**Local-first storage.** All reads and writes hit `localStorage` immediately. `sync.js` watches a whitelisted set of keys per app and pushes debounced updates to Supabase in the background. On load it pulls remote state and merges. Real-time sync via Supabase `postgres_changes` subscription.

**Shared chrome — `topbar.js`.** A sticky status bar injected on every page showing live counts for all five apps. The NEXUS wordmark uses the indigo→magenta gradient.

**PWA — `manifest.json` + `sw.js`.** Fully installable on iOS and Android. Launches full-screen with no browser chrome. Theme color `#0A0813`.

---

## File Structure

```
nexus/
├── index.html           — Goals + energy ring (home screen)
├── health.html          — Wellness hub (sleep, habits, recovery, dreams, journal)
├── gym.html             — Calisthenics strength tracker + charts + schedule
├── grind-log.html       — XP productivity tracker
├── valorant-cc.html     — Calisthenics skill progressions (planche, HS, FL, MU, L-sit, BL)
├── sync.js              — Supabase cloud sync helper (shared)
├── topbar.js            — Persistent nav bar + PWA service worker registration (shared)
├── sw.js                — Service worker (offline cache)
├── manifest.json        — PWA manifest (theme_color: #0A0813)
├── favicon-32.png
├── icon-192.png
├── icon-512.png
└── apple-touch-icon-180.png
```

---

## Storage Keys

| App | Key | Contents |
|---|---|---|
| Goals | `long_goals_v1` | Array of goal objects (title, current, target, unit, direction) |
| Goals | `day_window_v1` | Wake/sleep times for energy ring |
| Wellness | `wellness:sleep` | Sleep log entries |
| Wellness | `wellness:habits` | Habit completion by date |
| Wellness | `wellness:recovery` | Soreness, energy, stress entries |
| Wellness | `wellness:dreams` | Dream log entries |
| Wellness | `wellness:journal` | Journal entries (legacy) |
| Wellness | `journal:entry:YYYY-MM-DD` | Per-day journal entry (current) |
| Wellness | `wellness:done:YYYY-MM-DD` | Daily wellness completion flag |
| Gym | `ibrahim_gym_v1` | All workout state — exercises checked, done/missed flags, nutrition log, weight entries, body measurements, planche data |
| Gym | `ibrahim_gym_done` | Cross-page sync: workouts completed per date |
| Gym | `gym_pr_v1` | PR history per exercise name |
| Gym | `gym_measurements_v1` | Body measurement history |
| Gym | `gym_schedule_v1` | Training day schedule — array of 4 day-of-week numbers |
| Grind | `grind_log_v1` | XP log entries (task, category, xp, date) |
| Skills | `cali_skills_v1` | Per-skill level and session history for all 6 calisthenics skills |

---

## Getting Started

### 1. Cloud Sync (optional, but recommended)
1. Create a free project at [Supabase](https://supabase.com).
2. Run this SQL in the Supabase SQL editor:
```sql
create table app_state (
  key text primary key,
  data jsonb,
  updated_at timestamptz default now()
);
alter table app_state enable row level security;
create policy "public access" on app_state for all using (true);
```
3. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key:
   ```bash
   cp .env.example .env
   # then edit .env
   ```
   `.env` is gitignored — the real credentials never enter the repo.

### 2. Build
The committed source uses placeholders (`__SUPABASE_URL__`, `__SUPABASE_KEY__`) in `sync.js`. The build script swaps them for the real values from `.env` and writes a deployable `dist/` folder:
```bash
npm run build          # = node scripts/build.js
```
You need Node 18+ installed. No npm dependencies — the build script is pure Node.

### 3. Local preview
```bash
npm run dev            # build + serve dist/ on http://localhost:3000
# or, without npm:
node scripts/build.js && npx serve dist
```

### 4. Deploy
Push to a Git remote, then import on [Vercel](https://vercel.com). The included `vercel.json` tells Vercel to run `node scripts/build.js` and serve from `dist/`. **In the Vercel dashboard, add the same two env vars under Settings → Environment Variables** (`SUPABASE_URL` and `SUPABASE_KEY`) — Vercel will expose them to the build step.

### 5. Install on iPhone
Open your deployed URL in Safari → Share → **Add to Home Screen**. Launches full-screen. Theme color `#0A0813` makes the status bar match.

### 6. Set your training schedule
In `gym.html`, tap **⚙ Schedule** and select your 4 training days in order. Day A (Push+Planche) maps to your first selection, Day B to second, and so on.

---

## Adding a Sixth App

1. Create a new `.html` file. Copy the `:root` block from any existing page.
2. Include shared scripts:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="sync.js" defer></script>
<script src="topbar.js" defer></script>
```
3. Add an entry to the `TILES` array in `topbar.js` and `index.html`.
4. Call `initCloudSync({ appKey: 'yourapp', syncedKeys: [...] })` at page bottom.
5. Use `linear-gradient(135deg, #8A2BE2, #FF1493)` for progress fills and primary actions. Use `rgba(138,43,226,0.X)` for card backgrounds and surface tints.
6. If the new app needs additional secrets, add them to `.env.example`, the `PLACEHOLDER_FILES` list in `scripts/build.js`, and reference them as `__YOUR_TOKEN__` placeholders in the source.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Language | Vanilla JS (ES2020+), no framework |
| Styling | Pure CSS3, CSS custom properties |
| Charts | Chart.js 4.4 |
| Database | Supabase (Postgres + Realtime) |
| Auth | None — single-user, localStorage key-based |
| Hosting | Vercel (static) |
| Offline | Service Worker (Cache API) |

---

## Current Status — July 2026

Active daily use. Running the Deep Cyber Amethyst color system across all five pages.

### Latest changes (this build)

**Gym tracker overhaul**
- Workout split updated to full calisthenics focus: Push+Planche / Pull+Front Lever / Handstand+Core / Legs+Conditioning
- Flexible 4-day scheduling — any days of the week, not locked to Mon–Thu
- ⚙ Schedule modal with 7-day picker and live preview of the day→workout mapping
- Planche-only progression section removed; replaced with Skills CTA card linking to `valorant-cc.html`
- Exercises now include pseudo planche push-ups, scapular pull-ups, wall handstand, L-sit, freestanding kick-up practice, front lever hold, and explosive pull-ups (muscle-up prep)
- `skill` badge added for calisthenics skill exercises (highlighted border + glow)

**Calisthenics Skills tracker (new — replaces Valorant CC)**
- Full replacement of `valorant-cc.html` with a 6-skill progression system
- Per-skill progression ladders with step-by-step guides and "progress when" criteria for every level
- Session logging (hold time, reps, attempts) with sparkline trends
- Set-as-current level control — mark exactly where you are in each skill
- Overview grid on the home screen of the page shows all 6 skills at a glance
- Dashboard tile in `index.html` updated: emoji 🤸, name SKILLS, reads `cali_skills_v1`

**New localStorage key**
- `gym_schedule_v1` — stores the flexible training day array

### Previous feature work (still active)
- Wellness Hub: five-tab rebuild (Sleep, Habits, Recovery, Dreams, Journal)
- Energy ring wake/sleep times configurable via ⚙ gear icon
- Long-term goals system on home screen
- Gym: rest timer (wall-clock corrected), PR history per exercise, 8-week consistency chart, 16-week heatmap, weight tracker, nutrition log, body measurements

---

## Pending / Backlog

- `topbar.js` — update wellness pill to read `journal:entry:YYYY-MM-DD` (not old supplement keys)
- `topbar.js` — update Skills tile stat to read from `cali_skills_v1`
- Decide on a sixth app (candidates: focus timer / finance tracker)
- Sweep all Chart.js color values to confirm no leftover cyan/teal hex codes

---

## License

Private project. All rights reserved. No part of this codebase may be copied, modified, distributed, or used to build derivative works without the author's explicit written permission.