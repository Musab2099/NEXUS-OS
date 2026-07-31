# NEXUS — Deep Cyber Amethyst

> **Private project — all rights reserved.**
>
> NEXUS is Ibrahim's personal operating system. This repository is not open source and is not licensed for reuse, redistribution, modification, or forking without explicit permission.

NEXUS is a local-first progressive web app for goals, wellness, calisthenics training, productivity, and skill progression. It is built with vanilla JavaScript, HTML, and CSS. Data is written to `localStorage` first so the app remains useful offline, with optional Supabase synchronization between devices.

## At a glance

- **Frontend:** Vanilla JavaScript ES2020+, HTML5, CSS3
- **Backend:** Vercel serverless function at `/api/sync-health`
- **Database:** Supabase Postgres and Realtime
- **Runtime libraries:** Supabase JS 2 and Chart.js 4.4 loaded from jsDelivr
- **Offline support:** Service worker with network-first HTML and stale-while-revalidate static assets
- **Build:** Dependency-free Node script that creates `dist/` and injects browser sync credentials
- **Tests:** Node's built-in `node:test` runner
- **Visual system:** Deep Cyber Amethyst
- **Hosting:** Vercel or another static host for the generated frontend bundle

## App suite

| App | Source page | Purpose |
|---|---|---|
| Goals home | `src/pages/index.html` | Energy ring, long-term goals, app dock, and daily highlights |
| Wellness | `src/pages/health.html` | Sleep, habits, recovery, dreams, and journal |
| Gym | `src/pages/gym.html` | Four-day calisthenics training, PRs, charts, nutrition, and measurements |
| Live workout | `src/pages/live-workout.html` | Guided workout session with sets, reps, rest timer, and session saving |
| Grind Log | `src/pages/grind-log.html` | XP-based productivity tracking and category/rank summaries |
| Calisthenics Skills | `src/pages/progression-tab.html` | Planche, handstand, front lever, muscle-up, L-sit, and back lever progressions |

### Goals home

The home page is the command center. It has a configurable wake/sleep energy ring (`day_window_v1`), long-term goals with calculated progress, a cross-app dock, and daily summaries.

### Wellness

The Wellness page has five tabs: Sleep (duration, quality, seven-day chart, streaks), Habits (daily checklist and streaks), Recovery (soreness, energy, stress, readiness), Dreams (including lucid-dream statistics), and Journal (mood plus delayed autosave).

### Gym and live workout

The Gym page uses a flexible four-day split. The selected weekdays are stored in `gym_schedule_v1`; the first selected day is Day A, the second Day B, and so on. The default is Monday through Thursday.

| Day | Focus |
|---|---|
| A | Push + Planche |
| B | Pull + Front Lever |
| C | Handstand + Core |
| D | Legs + Conditioning |

Gym also includes exercise checklists, rest timers, PR history, consistency charts, training heatmaps, weight tracking, nutrition, body measurements, and Apple Health metrics. `live-workout.html` is the focused session view with set progression, rep controls, rest management, skipping/finishing actions, and local session history/snapshots.

### Grind Log

The Grind Log records Code, Study, Fitness, Content, Focus, and Other tasks. It provides XP history, a 14-day chart, category totals, and ranks from Rookie through Legend.

### Calisthenics Skills

`src/pages/progression-tab.html` is the current skills page; the former `valorant-cc.html` name is obsolete. It tracks Planche, Handstand, Front Lever, Muscle-Up, L-Sit, and Back Lever. Each skill has a progression ladder, level guide, current-level control, session logger, sparkline, recent sessions, and best-session indicator. State is stored in `cali_skills_v1`.

## Architecture

### Source and generated output

```text
NEXUS/
├── api/                         Vercel serverless functions
├── lib/                         Shared server-side validation and database modules
├── public/                      Root-level static assets and icons
├── scripts/                     Build script
├── src/
│   ├── data/                    PWA manifest source
│   ├── pages/                   HTML app pages
│   ├── scripts/                 Browser JavaScript
│   └── styles/                  Shared CSS files
├── supabase/                    SQL schema/migrations
├── test/                        Node test suite
├── sw.js                        Service worker source
├── vercel.json                  Vercel build and rewrite configuration
└── dist/                        Generated deployable frontend (gitignored)
```

`scripts/build.js` cleans and recreates `dist/`, copies pages and browser assets, places icons/manifest files at the bundle root, and substitutes `__SUPABASE_URL__` and `__SUPABASE_KEY__` in `src/scripts/sync.js`. Missing browser credentials leave cloud sync disabled while local-first behavior continues to work. The server-side `api/` and `lib/` files are not part of the public frontend bundle.

### Shared browser infrastructure

- `src/scripts/sync.js` — `initCloudSync()` whitelists local keys, pulls/pushes Supabase state with debouncing, subscribes to Realtime changes, and dispatches storage updates after remote state is applied.
- `src/scripts/topbar.js` — shared navigation/status UI, cross-app counts, responsive phone bottom bar, refresh hooks, and service-worker registration.
- `src/scripts/theme.js` — theme preference handling.
- `src/scripts/apple-health.js` — read-only Gym cache using `apple_health_metrics_v1` and authenticated `/api/sync-health` reads.
- `src/scripts/event-horizon.js` — shared circadian tinting, tilt, and tactile interactions where included.
- `sw.js` — service worker; bump `CACHE_VERSION` (`nexus-v7` currently) when changing cached assets or forcing a refresh.

### Cloud synchronization

Cloud sync is optional and local-first. The page configurations are:

| App key | Synced keys |
|---|---|
| `goals` | `long_goals_v1`, `day_window_v1` |
| `health` | `wellness:sleep`, `wellness:habits`, `wellness:recovery`, `wellness:dreams`, `wellness:journal`, plus `wellness:done:` |
| `gym` | `ibrahim_gym_v1`, `ibrahim_gym_done`, `gym_pr_v1`, `gym_measurements_v1`, `gym_schedule_v1` |
| `grind` | `grind_log_v1` |
| `calisthenics` | `cali_skills_v1` |

The sync client uses an `app_state` table. Minimal setup:

```sql
create table app_state (
  key text primary key,
  data jsonb,
  updated_at timestamptz default now()
);
alter table app_state enable row level security;
create policy "public access" on app_state for all using (true);
```

This permissive policy is suitable only for the current single-user design. Add authentication and user-scoped RLS before supporting multiple users.

## Local storage keys

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
| Apple Health | `apple_health_metrics_v1` | Cached server metrics |
| Apple Health | `apple_health_sync_token` | Browser read token |
| Live workout | `nx-workout-hist` | Saved session history |
| Live workout | `nx-session-snap` | In-progress session snapshot |
| Live workout | `nx-theme` | Live-workout theme |
| Grind | `grind_log_v1` | Productivity tasks and XP |
| Skills | `cali_skills_v1` | Skill levels and session history |
| Theme | `nexus-theme`, `nexus_theme`, `nexus-theme-index` | Theme preferences |

Use the existing page helpers and sync-aware setters when changing storage behavior.

## Apple Health API

`api/sync-health.js` is the Vercel function at `/api/sync-health`.

- `lib/health-validation.js` handles Bearer extraction, constant-time token comparison, flat payload validation, v2 mapping, date handling, and numeric/text normalization.
- `lib/supabase.js` resolves credentials, performs Supabase REST requests, reads date-filtered records, and upserts workouts.

| Method | Purpose | Authentication |
|---|---|---|
| `OPTIONS /api/sync-health` | CORS preflight | None |
| `POST /api/sync-health` | Upsert flat or Health Auto Export v2 workouts | `Authorization: Bearer <APPLE_HEALTH_SYNC_TOKEN>` |
| `PUT /api/sync-health` | Compatibility alias for the same validated upsert flow | Same Bearer token |
| `PATCH /api/sync-health` | Compatibility alias for the same validated upsert flow | Same Bearer token |
| `GET /api/sync-health?date=YYYY-MM-DD` | Read records for the Gym client | Same Bearer token |

Every response includes `Access-Control-Allow-Origin: *`. `OPTIONS` returns `200` with `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, OPTIONS` and `Access-Control-Allow-Headers: Content-Type, Authorization, X-Health-Sync-Token`. `PUT` and `PATCH` reuse the existing validated upsert path; unsupported methods return `405` with `Allow: GET, POST, PUT, PATCH, OPTIONS`. Trailing slashes are normalized in the handler without issuing a redirect, preserving the original method and request body.

### POST payloads

Flat/manual payloads remain supported:

```json
{
  "external_id": "manual-workout-1",
  "workout_date": "2026-07-31",
  "workout_type": "Manual Workout",
  "active_calories": 250,
  "avg_heart_rate": 138,
  "duration_minutes": 45,
  "source": "manual"
}
```

Health Auto Export v2 payloads have the form:

```json
{
  "data": {
    "workouts": [
      {
        "id": "apple-workout-123",
        "start": "2026-07-31T08:15:00Z",
        "name": "Traditional Strength Training",
        "activeEnergy": { "qty": 420 },
        "avgHeartRate": { "qty": 138 },
        "duration": { "qty": 52 }
      }
    ]
  }
}
```

For each nested workout, the endpoint maps `start`/`startDate` to `workout_date`, `name`/`workoutActivityType` to `workout_type`, `activeEnergy.qty`/`activeEnergy` to `active_calories`, `avgHeartRate.qty`/`heartRate.avg` to `avg_heart_rate`, `duration.qty` to `duration_minutes`, `id`/`uuid` to `external_id`, and sets `source` to `apple_health`. Missing values use the documented defaults. Records are upserted into `public.apple_health_logs` with `on_conflict=external_id`; stable IDs make retries idempotent. Apply [`supabase/apple_health_logs.sql`](supabase/apple_health_logs.sql) before using the endpoint.

## Setup and development

### Requirements

- Node.js 18+
- Supabase only when cloud sync or Apple Health persistence is needed
- No install step is required for build/tests. `npm run dev` uses `npx serve`.

### Environment

```bash
cp .env.example .env
```

Browser build variables:

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_KEY` — Supabase anon/public key.

Server-only API variables:

- `SUPABASE_SERVICE_ROLE_KEY` — service-role key; never expose it.
- `APPLE_HEALTH_SYNC_TOKEN` — private Bearer token shared with the export client.

The API also supports `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_KEY` as fallbacks. Never use the service-role key as the browser `SUPABASE_KEY`.

### Commands

```bash
npm run build       # node scripts/build.js; writes dist/
npm test            # node --test
npm run dev         # build and serve dist/ at http://localhost:3000
```

A dependency-free preview alternative is:

```bash
node scripts/build.js
python3 -m http.server -d dist 8000
```

Focused syntax checks:

```bash
node --check api/sync-health.js
node --check lib/health-validation.js
node --check lib/supabase.js
node --check test/sync-health.test.js
```

## Vercel and Health Auto Export checklist

### Supabase

- [ ] Run [`supabase/apple_health_logs.sql`](supabase/apple_health_logs.sql).
- [ ] Confirm `apple_health_logs.external_id` has a unique constraint for upserts.
- [ ] Keep RLS enabled and do not add anonymous write policies for `apple_health_logs`.
- [ ] Configure `app_state` if browser cloud sync is needed.

### Vercel environment variables

Set values under **Project → Settings → Environment Variables** for every required environment, then redeploy after changes.

| Variable | Used by | Security |
|---|---|---|
| `SUPABASE_URL` | Build-time browser sync | Public project URL |
| `SUPABASE_KEY` | Build-time browser sync/API fallback | Anon/public key only |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime Apple Health API | Server-only |
| `APPLE_HEALTH_SYNC_TOKEN` | Runtime API authentication | Private Bearer secret |

- [ ] Do not put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*`, HTML, client JavaScript, or Health Auto Export.
- [ ] Confirm the project root, branch, and environment scope are correct.
- [ ] Confirm `api/sync-health.js` deploys as `/api/sync-health` and root-level `lib/` dependencies are in the function bundle.
- [ ] Redeploy after adding or rotating environment variables.

### Health Auto Export

- [ ] Include Workouts and select JSON/`ExportVersion.v2` when available.
- [ ] Use exactly `https://YOUR-DOMAIN/api/sync-health`.
- [ ] Use `POST` and `Content-Type: application/json`.
- [ ] Send `Authorization: Bearer YOUR_APPLE_HEALTH_SYNC_TOKEN`.
- [ ] Allow the `OPTIONS` preflight.
- [ ] Send the v2 body unchanged and preserve a stable `id`/`uuid` when available.
- [ ] Preserve the iPhone-local `start`/`startDate` value.

### Smoke tests

```bash
# Preflight: expected HTTP 200 plus the CORS headers.
curl -i -X OPTIONS "https://YOUR-DOMAIN/api/sync-health" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"

# Flat POST: expected HTTP 201 with {"ok":true,...}.
curl -i -X POST "https://YOUR-DOMAIN/api/sync-health" \
  -H "Authorization: Bearer YOUR_APPLE_HEALTH_SYNC_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"external_id":"manual-smoke-test-1","workout_date":"2026-07-31","workout_type":"Manual Test","active_calories":1,"avg_heart_rate":null,"duration_minutes":1,"source":"manual"}'

# PUT compatibility check: expected HTTP 201, not 405.
curl -i -X PUT "https://YOUR-DOMAIN/api/sync-health/" \
  -H "Authorization: Bearer YOUR_APPLE_HEALTH_SYNC_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"external_id":"manual-put-test-1","workout_date":"2026-07-31","workout_type":"PUT Test","active_calories":1,"avg_heart_rate":null,"duration_minutes":1,"source":"manual"}'
```

- [ ] Invalid/missing tokens return `401`.
- [ ] Valid requests return `201`.
- [ ] The row appears in `apple_health_logs`.
- [ ] Retrying the same `external_id` updates rather than duplicates.

Troubleshooting:

- **405:** likely stale deployment or wrong URL; use exactly `/api/sync-health` and test `OPTIONS`.
- **401:** verify the exact Bearer token, environment scope, and header format.
- **500:** verify runtime Supabase credentials and redeploy.
- **502:** verify the SQL schema, Supabase URL/key pair, and unique `external_id` constraint.

## Vercel configuration

`vercel.json` runs `node scripts/build.js`, publishes `dist/`, and rewrites `/`, `/health`, `/gym`, `/grind-log`, and `/progression-tab` to generated pages. The catch-all frontend rewrite does not replace the repository-level API function.

## Design system

Deep Cyber Amethyst tokens include `--bg: #0A0813`, `--bg-card: #12101F`, `--amethyst: #8A2BE2`, `--indigo: #B026FF`, `--magenta: #FF1493`, and `--violet-muted: #6B4FA0`. The primary gradient is:

```css
linear-gradient(135deg, #8A2BE2 0%, #B026FF 50%, #FF1493 100%)
```

Use it for progress fills, rings, sparklines, and primary actions. Preserve the project rule against cyan/teal colors.

## Adding an app

1. Add the page under `src/pages/`.
2. Add it to `PASSTHROUGH_FILES` in `scripts/build.js`.
3. Add navigation entries to `src/scripts/topbar.js` and the home dock.
4. Add an explicit `appKey` and storage whitelist to `initCloudSync()` if it syncs.
5. Update `sw.js`'s cache list/version if it should work offline.
6. Update `.env.example`/`PLACEHOLDER_FILES` only for new build-time placeholders.
7. Run `npm run build` and `npm test`.

## Limitations

- There is no user login; this is a single-user deployment.
- Apple Health uses one shared Bearer token rather than per-user sessions.
- The service-role key bypasses RLS and must remain server-only.
- Visual regression remains manual across desktop/mobile, offline mode, and two-tab sync.

## License

Private project. All rights reserved. No part of this codebase may be copied, modified, distributed, or used to build derivative works without the author's explicit written permission.

