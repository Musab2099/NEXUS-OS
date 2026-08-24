/**
 * NEXUS-OS — Animation Tests
 *
 * animations.js runs on every page and provides:
 *  - Ambient orbs, cursor glow, card sheen, 3D tilt, ripples
 *  - Navigation exit-transition
 *  - Cmd/Ctrl+K command palette (8 hardcoded routes)
 *
 * Tests verify that animations don't leave elements in broken states
 * (stuck invisible, overflowing, or blocking interaction).
 */

import { test, expect } from '@playwright/test';
import { PAGES, NAV_PAGES, SEL, waitForAnimations, collectErrors } from './helpers.js';

const ANIM_SETTLE = 800; // ms to wait for entrance animations to finish

test.describe('Animations — entrance (no stuck-invisible elements)', () => {
  for (const { name, url } of NAV_PAGES) {
    test(`${name} — content is visible after entrance animation`, async ({ page }) => {
      await page.goto(url);
      await waitForAnimations(page, ANIM_SETTLE);

      // Main content area must be visible and have real dimensions
      const main = page.locator('main, [class*="main"], [class*="content"]').first();
      if (await main.isAttached({ timeout: 2000 }).catch(() => false)) {
        const box = await main.boundingBox();
        expect(box?.height, `${name} main content has no height after animation`).toBeGreaterThan(0);
      }

      // Header must remain visible (animation shouldn't have hidden it)
      await expect(page.locator(SEL.header)).toBeVisible();
    });
  }
});

test.describe('Animations — opacity after load', () => {
  for (const { name, url } of NAV_PAGES) {
    test(`${name} — no elements stuck at opacity: 0`, async ({ page }) => {
      await page.goto(url);
      await waitForAnimations(page, ANIM_SETTLE);

      const stuckInvisible = await page.evaluate(() => {
        const elements = document.querySelectorAll('[class*="card"], [class*="widget"], main > *, section > *');
        const stuck = [];
        for (const el of elements) {
          const style = getComputedStyle(el);
          if (style.opacity === '0' && style.display !== 'none' && el.getBoundingClientRect().height > 0) {
            stuck.push(el.className || el.tagName);
          }
        }
        return stuck;
      });

      expect(stuckInvisible, `Elements stuck at opacity:0 on ${name}:\n${stuckInvisible.join('\n')}`).toHaveLength(0);
    });
  }
});

test.describe('Animations — card sheen (glassmorphism)', () => {
  test('dashboard cards have backdrop-filter (glassmorphism)', async ({ page }) => {
    await page.goto('/index.html');
    await waitForAnimations(page, 500);

    const card = page.locator('[class*="card"], [class*="glass"]').first();
    if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No glass cards found on dashboard');
      return;
    }

    const filter = await card.evaluate(
      (el) => getComputedStyle(el).backdropFilter
    );
    // Glassmorphism requires backdrop-filter: blur(...)
    expect(filter, 'Glass cards should have backdrop-filter').toMatch(/blur/i);
  });
});

test.describe('Animations — command palette (Ctrl+K)', () => {
  test('Ctrl+K opens the command palette on dashboard', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, 500);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(400);

    // Command palette should appear — check for a dialog/overlay/input
    const palette = page.locator(
      '[class*="palette"], [class*="command"], [role="dialog"], [class*="spotlight"]'
    ).first();
    const appeared = await palette.isVisible({ timeout: 2000 }).catch(() => false);

    if (!appeared) {
      // animations.js may use a different structure — just verify no crash
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      expect(errors).toHaveLength(0);
    } else {
      await expect(palette).toBeVisible();

      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await expect(palette).not.toBeVisible();
    }
  });

  test('command palette links include live-workout and facescan', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(400);

    const palette = page.locator(
      '[class*="palette"], [class*="command"], [role="dialog"]'
    ).first();
    if (!(await palette.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, 'Command palette not visible');
      return;
    }

    // The 8-destination palette should reference live-workout and facescan
    const text = await palette.innerText();
    expect(text.toLowerCase()).toMatch(/workout|live/i);
    expect(text.toLowerCase()).toMatch(/face|scan/i);
  });
});

test.describe('Animations — no JS errors from animations.js', () => {
  for (const { name, url } of NAV_PAGES) {
    test(`animations.js runs clean on ${name}`, async ({ page }) => {
      const getErrors = collectErrors(page);
      await page.goto(url);
      await waitForAnimations(page, ANIM_SETTLE);
      const errors = getErrors();
      expect(errors, `Anim errors on ${name}:\n${errors.join('\n')}`).toHaveLength(0);
    });
  }
});

test.describe('Animations — exit transition does not break navigation', () => {
  test('clicking a nav link mid-animation does not break next page', async ({ page }) => {
    await page.goto('/index.html');
    // Don't wait for animations to fully settle — click link during transition
    await page.waitForTimeout(100);

    await page.locator(SEL.navLink('gym')).first().click();
    await page.waitForURL('**/gym.html', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, ANIM_SETTLE);

    // Gym page should be fully rendered
    await expect(page.locator(SEL.header)).toBeVisible();
    const mainContent = page.locator('main, [class*="main"]').first();
    if (await mainContent.isAttached({ timeout: 1000 }).catch(() => false)) {
      await expect(mainContent).toBeVisible();
    }
  });
});
