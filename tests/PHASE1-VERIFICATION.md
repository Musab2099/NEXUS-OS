# Phase 1 verification — Step 0

## Commits and execution

- Baseline: `3a76ef4` in a separate detached Git worktree.
- Phase 1: `6f363c3` on `feat/sync-and-dashboard-redesign`.
- The feature branch was pushed to origin; main was not changed.
- The baseline worktree was removed after testing.
- Both builds used the existing local build-time credential configuration, without copying or printing credentials.
- Both runs used fresh servers (`serve dist`) on isolated ports 3101 and 3102, four workers, and the existing Playwright projects and test files.
- Suite: animations, modules, navigation, PWA, smoke, and themes.
- Each run: **207 tests, 189 passed, 18 failed**.
- **All 18 failing test identities match. No newly failing Phase 1 test was found.**
- Visual baselines were not updated. The prior visual run reported 11 failures and two passes; it is not part of this functional comparison.

## Matching failures

| Spec | Test | Projects / pages | Count |
| --- | --- | --- | --- |
| animations | Content visible after entrance | Chromium: dashboard, wellness, gym, calisthenics, grind | 5 |
| animations | No elements stuck at opacity zero | Chromium: dashboard, wellness, gym, grind | 4 |
| animations | Runtime has no JS errors | Chromium: grind | 1 |
| animations | Mid-animation navigation | Chromium | 1 |
| navigation | Grind link navigates correctly | Chromium, mobile | 2 |
| navigation | Grind active link | Chromium, mobile | 2 |
| smoke | Grind header contract | Chromium, mobile | 2 |
| themes | Theme persists across navigation | Chromium | 1 |
| | | **Total** | **18** |

### Failure details

- Entrance tests call `locator.isAttached()`, which is not supported by the installed Playwright version. Grind also times out.
- Opacity tests include decorative `nx-card-sheen` elements, which are intentionally transparent until hover. Dashboard's offscreen entrance state can also be included. Grind times out.
- Grind clean-route tests time out; direct-page module checks pass. These failures reproduce on the baseline and were left unchanged.
- The exit-transition test expects `/gym.html`, while navigation uses `/gym`.
- Cross-page theme persistence fails with `net::ERR_FAILED` at `/gym.html` in **both** commits.

## `/gym.html` investigation

A separate browser diagnostic compared the same navigation with service workers enabled and blocked:

1. Direct HTTP request to `/gym.html` returns **301**, `Location: /gym`.
2. With the service worker enabled, browser navigation to `/gym.html` fails with `net::ERR_FAILED`.
3. In the same context, navigation to `/gym` succeeds and displays the Gym header; its response is served through the service worker.
4. With the service worker blocked, `/gym.html` follows its redirect and Gym loads successfully.

This isolates the failure to the existing service-worker/redirect path rather than Phase 1 CSS or a missing Gym document. The service worker reconstructs network responses after reading their bodies, losing redirect response semantics. The diagnostic supports that as the likely cause; this step did not change the worker or pre-existing tests.

## Preview status

The feature-branch push succeeded. A Vercel preview URL was not available in the local project configuration or push output. The remote deployment build and preview appearance have **not** been verified. Obtain the actual preview URL before judging the theme or claiming deployment verification.

## Scope

No application fix was made in Step 0 because the requested comparison found no newly failing tests. This report is the Step 0 commit artifact; no empty fix commit was created. Temporary diagnostic/config files were removed, and generated comparison artifacts remain under ignored `tests/test-results/phase1-comparison/`.
