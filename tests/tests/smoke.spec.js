/**
 * NEXUS-OS — Smoke Tests
 *
 * Fastest sanity check. If these fail, stop everything — something
 * fundamental is broken. Tests hit every page URL directly.
 *
 * Covers:
 *  - Every page returns HTTP 200 (not a 404 from a bad build)
 *  - No uncaught JS errors on load
 *  - Static header is present (header contract not broken by an agent)
 *  - Canonical CSS variables are defined on :root
 *  - Static assets (themes.css, sw.js, manifest.json) exist
 */

import { test, expect } from '@playwright/test';
import { PAGES, SEL, REQUIRED_CSS_VARS, getCSSVar, collectErrors } from './helpers.js';

// ─── Every page returns 200 ───────────────────────────────────────────────────

test.describe('Smoke — HTTP status', () => {
  for (const { name, url } of PAGES) {
    test(`${name} (${url}) returns 200`, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status(), `${url} returned ${res?.status()}`).toBe(200);
    });
  }
});

// ─── No JS errors on load ────────────────────────────────────────────────────

test.describe('Smoke — no JS errors', () => {
  for (const { name, url } of PAGES) {
    test(`${name} loads without JS errors`, async ({ page }) => {
      const getErrors = collectErrors(page);
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      const errors = getErrors();
      expect(errors, `JS errors on ${url}:\n${errors.join('\n')}`).toHaveLength(0);
    });
  }
});

// ─── Header contract ─────────────────────────────────────────────────────────

test.describe('Smoke — header contract', () => {
  for (const { name, url } of PAGES) {
    test(`${name} has correct header markup`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // The static header must be present (topbar.js only wires it — doesn't create it)
      await expect(page.locator(SEL.header)).toBeAttached();
      await expect(page.locator(SEL.logo)).toBeVisible();
      await expect(page.locator(SEL.navPill)).toBeVisible();
      await expect(page.locator(SEL.themeButton)).toBeVisible();
    });
  }

  test('dashboard — all 6 nav links are present', async ({ page }) => {
    await page.goto('/index.html');
    const routes = ['home', 'goals', 'wellness', 'gym', 'calisthenics', 'grind'];
    for (const route of routes) {
      await expect(
        page.locator(SEL.navLink(route)),
        `nav-link data-route="${route}" missing`
      ).toBeAttached();
    }
  });
});

// ─── CSS design tokens ───────────────────────────────────────────────────────

test.describe('Smoke — CSS design tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  for (const varName of REQUIRED_CSS_VARS) {
    test(`${varName} is defined on :root`, async ({ page }) => {
      const val = await getCSSVar(page, varName);
      expect(val, `${varName} should be a non-empty string`).not.toBe('');
    });
  }

  test('page title contains NEXUS', async ({ page }) => {
    await expect(page).toHaveTitle(/nexus/i);
  });
});

// ─── Static assets ───────────────────────────────────────────────────────────

test.describe('Smoke — static assets', () => {
  const assets = [
    '/src/styles/themes.css',
    '/src/styles/style.css',
    '/src/scripts/topbar.js',
    '/src/scripts/theme.js',
    '/src/scripts/animations.js',
    '/sw.js',
    '/manifest.json',
  ];

  for (const asset of assets) {
    test(`${asset} returns 200`, async ({ page }) => {
      const res = await page.goto(asset);
      expect(res?.status(), `${asset} → ${res?.status()}`).toBeLessThan(400);
    });
  }

  test('manifest.json is valid JSON with required fields', async ({ page }) => {
    const res = await page.goto('/manifest.json');
    const json = await res?.json().catch(() => null);
    expect(json).not.toBeNull();
    expect(json?.name || json?.short_name).toBeTruthy();
    expect(json?.start_url).toBeTruthy();
    expect(json?.icons?.length).toBeGreaterThan(0);
  });
});
