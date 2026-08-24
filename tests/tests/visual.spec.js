/**
 * NEXUS-OS — Visual Regression Tests
 *
 * Screenshots each page at a stable state and compares to stored baselines.
 * Any pixel diff > 1% fails the test.
 *
 * First run (no baselines yet): run `npm run test:update-snapshots` — this
 * generates the .png files in tests/__snapshots__/. Commit them to git.
 *
 * After intentional design changes: re-run with --update-snapshots and commit.
 *
 * What this catches:
 *  - Agent changes a colour, margin, font, or layout
 *  - Broken animation left in wrong end-state
 *  - Theme not applying on load
 *  - Card / bento layout shifted
 */

import { test, expect } from '@playwright/test';
import {
  NAV_PAGES, THEMES, THEME_STORAGE_KEY,
  switchTheme, waitForAnimations, FREEZE_CSS,
} from './helpers.js';

async function prepareForScreenshot(page) {
  await page.waitForLoadState('networkidle');
  // Freeze all animations for stable pixel-perfect screenshots
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.waitForTimeout(400);
}

// ─── Every nav page — desktop ─────────────────────────────────────────────────

test.describe('Visual — Pages (desktop)', () => {
  for (const { name, url } of NAV_PAGES) {
    test(`${name} — desktop screenshot`, async ({ page }) => {
      await page.goto(url);
      await prepareForScreenshot(page);
      await expect(page).toHaveScreenshot(`page-${name}-desktop.png`, {
        fullPage: true,
      });
    });
  }
});

// ─── Mobile ───────────────────────────────────────────────────────────────────

test.describe('Visual — Pages (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  test('dashboard — mobile screenshot', async ({ page }) => {
    await page.goto('/index.html');
    await prepareForScreenshot(page);
    await expect(page).toHaveScreenshot('page-dashboard-mobile.png', {
      fullPage: true,
    });
  });

  test('gym — mobile screenshot', async ({ page }) => {
    await page.goto('/gym.html');
    await prepareForScreenshot(page);
    await expect(page).toHaveScreenshot('page-gym-mobile.png', { fullPage: true });
  });
});

// ─── Theme screenshots ────────────────────────────────────────────────────────

test.describe('Visual — Themes', () => {
  for (const { key } of THEMES) {
    test(`dashboard in ${key} theme`, async ({ page }) => {
      // Set theme before load so no flash of wrong theme
      await page.goto('/index.html');
      await page.evaluate(
        ([k, storageKey]) => localStorage.setItem(storageKey, k),
        [key, THEME_STORAGE_KEY]
      );
      await page.reload();
      await prepareForScreenshot(page);

      await expect(page).toHaveScreenshot(`theme-${key}-dashboard.png`, {
        fullPage: true,
      });
    });
  }
});

// ─── Component-level screenshots ─────────────────────────────────────────────

test.describe('Visual — Components', () => {
  test('header / navbar', async ({ page }) => {
    await page.goto('/index.html');
    await prepareForScreenshot(page);

    const header = page.locator('header.navbar').first();
    await expect(header).toHaveScreenshot('component-navbar.png');
  });

  test('theme dropdown (open state)', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    // Open the dropdown
    await page.locator('[data-theme-button]').first().click();
    await page.waitForTimeout(300);
    await page.addStyleTag({ content: FREEZE_CSS });

    const dropdown = page.locator('[data-theme-control]').first();
    await expect(dropdown).toHaveScreenshot('component-theme-dropdown.png');
  });

  test('first bento card on dashboard', async ({ page }) => {
    await page.goto('/index.html');
    await prepareForScreenshot(page);

    const card = page.locator('[class*="card"], [class*="bento"] > *').first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(card).toHaveScreenshot('component-bento-card.png');
    }
  });
});
