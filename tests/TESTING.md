# NEXUS-OS Testing

Playwright E2E + visual regression. Runs on every push via GitHub Actions.

## Prerequisites

NEXUS has a build step. Tests run against `dist/` (the built output), not `src/` directly.

Make sure `npm run dev` works from the NEXUS root before running tests.

---

## Setup (one-time)

```bash
# From the NEXUS root — install app deps if you haven't
npm install

# From the tests/ folder
cd tests
npm install
npx playwright install chromium
```

---

## Running Tests

All commands from the `tests/` directory. The `playwright.config.js` webServer
automatically runs `npm run dev` in the NEXUS root (builds + serves `dist/`).

```bash
# All tests
npm test

# Individual suites
npm run test:smoke      # Fastest — HTTP 200, no JS errors, header contract, CSS vars
npm run test:nav        # Nav links, active states, mobile layout
npm run test:themes     # Theme switching, localStorage persistence
npm run test:modules    # Per-module feature checks (gym, calisthenics, etc.)
npm run test:pwa        # Service worker, manifest, meta tags
npm run test:visual     # Screenshot comparison

# Against a deployed URL (skip local server)
BASE_URL=https://nexus-xxx.vercel.app npm test

# Open HTML report after a run
npm run test:report
```

---

## First-Time Visual Baselines

Visual tests fail until you generate baselines:

```bash
npm run test:update-snapshots
git add tests/__snapshots__
git commit -m "chore: add visual regression baselines"
```

After any intentional design change, rerun `--update-snapshots` and commit the new baselines.

---

## File Structure

```
tests/
├── helpers.js             ← ALL selectors and shared utils — fix changes here
├── smoke.spec.js          ← Every page HTTP 200, no JS errors, header contract, CSS vars
├── navigation.spec.js     ← Nav link → correct URL, active state, mobile layout
├── themes.spec.js         ← Switch themes, localStorage, data-theme on <html>
├── animations.spec.js     ← Entrance anims settle, no stuck elements, Ctrl+K palette
├── modules.spec.js        ← Per-page feature checks for all 7 modules
├── pwa.spec.js            ← SW registers, manifest fields, icon files, meta tags
└── visual.spec.js         ← Screenshot baselines for every page + themes

playwright.config.js       ← Config: baseURL, webServer (builds NEXUS root)
package.json               ← npm scripts + @playwright/test

.github/workflows/
└── test.yml               ← CI: smoke job first (fast), then full suite on pass
```

---

## Fixing Broken Selectors

When an agent renames a class or attribute, **fix it in `tests/helpers.js`** — all specs import from there.

The most stable selectors in NEXUS use the attributes topbar.js reads:
- `[data-route="gym"]` on nav links (stable — topbar.js depends on it)
- `[data-theme-option="nexus-dark"]` on theme buttons
- `header.navbar[data-navbar]` on the header
- `[data-theme-control]` on the theme dropdown wrapper

These won't change unless the feature itself breaks.

---

## Adding a New Module / Page

1. Add the page to `PAGES` in `helpers.js` (with `route` and `url`)
2. Add `data-route="<route>"` to the nav link in **every** existing page's header
3. Add a `test.describe` block in `modules.spec.js`
4. Run `npm run test:update-snapshots` for the new visual baseline
5. Commit the snapshot

---

## CI Overview

| Job | Runs | Approx time |
|-----|------|-------------|
| `smoke` | Every push | ~1 min |
| `full` | After smoke passes | ~5 min |

Failed runs upload the HTML report + visual diffs as GitHub Actions artifacts (Actions tab → run → Artifacts).

---

## Common Failures

| Failure | Cause | Fix |
|---------|-------|-----|
| All tests 404 | Build not run / `dist/` empty | Run `node scripts/build.js` first |
| `nav-link [data-route="X"] missing` | Nav link missing from a page's static header | Add it to every page's `<header>` HTML |
| Theme test: `data-theme` not set | `theme.js` not loaded or `NexusTheme.init()` not called | Check `<script src="/scripts/theme.js" defer>` is in `<head>` |
| Visual diff > 1% | Intentional design change | `npm run test:update-snapshots` and commit |
| SW not registered | `sw.js` broken or 404 | Check `sw.js` in dist root; bump `CACHE_VERSION` |
| `NexusWorkoutStore undefined` | `workout-persistence.js` not loaded on live-workout | Check script tag on that page |
