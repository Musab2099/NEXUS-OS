# Phase 2 PR review

## Bugs found and fixed

- Empty online reconnects could leave sync status pending indefinitely. Empty flushes now settle client initialization; CDN imports and client queries are bounded. Regression tests simulate hung imports/queries.
- Queued/local hydration results were passed into remote merge callbacks. Local results now bypass remote merging; concurrent-save tests verify local edits survive.
- Workout saves bypassed NexusSync with a second direct local write, and load wrote the mirror again after NexusSync's revision guard. Synced writes now belong to NexusSync; local-only fallback remains available. Save results no longer claim local success after a rejected save with no stored payload.
- Gym restoration queued stale tracker state before canonical hydration and restored explicitly false/empty fields. Canonical tracker hydration now runs first; legacy restoration fills absent fields only. Gym restoration also finds its retained session when Live is the top-level payload.
- Gym and dashboard completion awards used different name dedupe rules. Gym now recognizes both legacy award names and uses correct day labels.
- Retained Gym sessions were ignored by progression after a new unfinished Live session. Their completion evidence now contributes once per date.
- Progression fixture dates used the wall clock instead of calculate(now); invalid dates/null rows and empty or invalid schedules could produce incorrect results or throw. Validation uses the fixture clock, valid schedule days and zero-denominator guards.
- Duplicate habit definitions and synergy amounts could distort progression. Habit IDs are unique; once-per-date workout/habit bonuses use the approved 50/25 XP values.
- Default habit definitions were never persisted after user completion, leaving Discipline at zero. Definitions now save through sync at the first user toggle, not during boot.
- Dashboard sleep/mood quick logs did not immediately update progression. They now refresh it, and the dashboard Grind total uses the shared lifetime calculation.
- Grind's obsolete rank formula could briefly replace the shared crystal rank. The old formula is removed. Task deletion also now deletes the actual selected row with interleaved dates.
- Live set snapshots lacked unit/session ID. New sets retain both alongside muscles and warm-up/skill flags. Completed-set persistence now includes the next-set cursor; a slow hydration cannot replace a newly started session.
- Mobile Arctic/Focus theme menus were covered by page content. Shared navbar stacking now prevents click interception.
- Duplicate synced-key writes in Gym, Wellness, Grind and dashboard helpers now use NexusSync first, retaining direct local writes only when the engine is absent.

## Verification performed

- `git diff main...HEAD --stat` and Phase-2 commit diffs reviewed; shared modules, tests, changed page logic and CSS inspected. Public method names/signatures retained.
- Build and JavaScript syntax checks passed. **21 unit tests passed**. Unit regressions cover empty data, fixed fixture XP, ranks at 0/499/500/1499/1500/6000/7000/9000, clamping/zero targets, per-date bonuses, sessions, online-event queue flush, insert-only backfill twice, newer remote records, hung CDN/client queries and edit-during-hydration.
- Browser review: **57 passed** (48 initial-layout cases: eight pages × 390/1280px × three stored themes; nine feature/interaction checks including the existing progression tests). Console/page-error and overflow checks, real theme-menu clicks on six menu-bearing pages, quick actions, Gym hydration, Live units/session metadata, reload cursor, and shared/max-rank totals passed. Sync is stubbed and service workers blocked for these checks.
- Baseline-equivalent full functional suite (animations/modules/navigation/PWA/smoke/themes, Chromium plus configured mobile project): **207 total, 196 passed, 11 failed**. Final run used an owned server on port 3110 after a discarded reused-server run lost its server and returned connection-refused errors.
- All final 11 failure identities are contained in the known 18 from PHASE1-VERIFICATION.md; **no new failure identities**. Seven former failures pass: Grind animation-runtime errors (one), Grind navigation/active-state (four), and Grind header contract (two).
- Tracked env filenames list only `.env.example`. Source/test/build files were scanned for JWT and service-role secret patterns without printing values; no newly tracked credentials found. sync.js retains credential placeholders. Generated logs/probes are removed, not committed.

## Remaining issues (not changed)

1. Five entrance tests use unsupported Playwright `locator.isAttached()` (dashboard/wellness/gym/calisthenics/grind). Existing test defects, not Phase-2 regressions.
2. Four opacity tests count intentionally transparent decorative `.nx-card-sheen` (dashboard/wellness/gym/grind). Existing false positives; no UI opacity changes made to satisfy them.
3. One mid-animation navigation test waits for `/gym.html` although clean navigation ends at `/gym`. Existing expectation mismatch.
4. One theme persistence test hits the existing service-worker `.html` redirect `net::ERR_FAILED`. `sw.js` deliberately remains untouched.
5. Real multi-device concurrent edits still use last-writer-wins per key, not a transactional conflict-resolution protocol. Mock verification is not proof of production concurrency safety.

## Not verified locally

- Production Supabase/RLS, real CDN outage timing, real remote accounts/devices, Vercel deployment and preview appearance.
- Pixel-by-pixel visual review: screenshots were captured for initial-layout cases but no manual image inspection or baseline update is claimed. Layout checks are automated visibility/overflow/interactions, not a visual design approval.
- Live Workout uses its existing legacy theme control; initial stored-theme combinations were exercised, but no shared THEME dropdown is present there. Offline has no theme toggle.
- `.env.example` contents could not be inspected with read_files (blocked); no secret values were requested or printed.

## Service-worker handoff

Add exactly this line within `CACHE_FILES` in `sw.js` (not modified in this review):

```js
'/scripts/progression.js',
```

The muscle map remains an honest training-activity rank. Old sets without muscle labels remain unclassified; warm-ups do not contribute. No features or deployment actions were added by this review.
