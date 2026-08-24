/**
 * NEXUS-OS Test Helpers
 *
 * Single source of truth for selectors, page routes, and utilities.
 * When an agent renames something, fix it here — every spec inherits the fix.
 *
 * NEXUS is a multi-page app (not SPA). Navigation goes to real HTML files.
 * Each page has an identical static <header> wired by topbar.js.
 */

// ─── Pages ────────────────────────────────────────────────────────────────────
// All routable pages. `route` = data-route on the nav-link (null = no nav link).
export const PAGES = [
  { name: 'dashboard',     route: 'home',          url: '/index.html' },
  { name: 'wellness',      route: 'wellness',       url: '/health.html' },
  { name: 'gym',           route: 'gym',            url: '/gym.html' },
  { name: 'calisthenics',  route: 'calisthenics',   url: '/progression-tab.html' },
  { name: 'grind',         route: 'grind',          url: '/grind-log.html' },
  { name: 'facescan',      route: null,             url: '/facescan.html' },
  { name: 'live-workout',  route: null,             url: '/live-workout.html' },
];

// Pages reachable from the nav bar (have a data-route link)
export const NAV_PAGES = PAGES.filter(p => p.route !== null);

// ─── Selectors ────────────────────────────────────────────────────────────────
export const SEL = {
  // Header (same on every page — defined in HTML, not injected by topbar.js)
  header:       'header.navbar[data-navbar]',
  logo:         'a.logo',
  logoText:     '.logo-text',
  navPill:      'nav.nav-pill',
  navLink:      (route) => `a.nav-link[data-route="${route}"]`,
  statusPill:   '.status-pill',

  // Theme controls
  themeControl: '[data-theme-control]',
  themeButton:  '[data-theme-button]',
  themeMenu:    '[data-theme-menu]',
  themeOption:  (theme) => `[data-theme-option="${theme}"]`,

  // Cards / content
  card:         '[class*="card"], [class*="glass"]',
  main:         'main, [class*="main"], [class*="content"]',
};

// Theme identifiers (values used in data-theme-option buttons + localStorage)
export const THEMES = [
  { key: 'nexus-dark',    label: 'NEXUS Dark' },
  { key: 'arctic-white',  label: 'Arctic White' },
  { key: 'periwinkle',    label: 'Focus' },
];

// localStorage key for the active theme
export const THEME_STORAGE_KEY = 'nexus-theme';

// CSS variables that must be defined on :root in every theme
export const REQUIRED_CSS_VARS = [
  '--bg', '--card', '--border',
  '--t1', '--t2', '--t3',
  '--a1', '--a2', '--a3',
];

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Returns the computed value of a CSS custom property on :root */
export async function getCSSVar(page, varName) {
  return page.evaluate(
    (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
    varName
  );
}

/** Returns the current data-theme value from <html> */
export async function getActiveTheme(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

/** Collects console errors + uncaught exceptions. Call before action, read after. */
export function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  // Filter out known non-fatal noise
  return () => errors.filter(
    (e) => !e.includes('WebSocket') && !e.includes('Failed to fetch') &&
           !e.includes('net::ERR_') && !e.includes('supabase')
  );
}

/** Waits for CSS transitions to finish (freeze-then-settle approach) */
export async function waitForAnimations(page, ms = 600) {
  await page.waitForTimeout(ms);
}

/** Opens the theme dropdown and clicks a specific theme option */
export async function switchTheme(page, themeKey) {
  const btn = page.locator(SEL.themeButton).first();
  // Open dropdown if menu isn't visible
  const menu = page.locator(SEL.themeMenu).first();
  const isOpen = await menu.isVisible({ timeout: 500 }).catch(() => false);
  if (!isOpen) {
    await btn.click();
    await page.waitForTimeout(200);
  }
  await page.locator(SEL.themeOption(themeKey)).first().click();
  await waitForAnimations(page, 400);
}

/** Disables all CSS transitions/animations for stable screenshots */
export const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-delay: 0ms !important;
    transition-duration: 0ms !important;
    transition-delay: 0ms !important;
  }
`;
