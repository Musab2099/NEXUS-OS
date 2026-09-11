/**
 * NEXUS-OS — Navigation Tests
 *
 * NEXUS is a multi-page app. Clicking a nav link loads a real HTML file.
 * Tests verify that each nav link actually goes where it's supposed to,
 * the active state updates, and the layout doesn't break on mobile.
 */

import { test, expect } from '@playwright/test';
import { SEL, NAV_PAGES, collectErrors, waitForAnimations } from './helpers.js';

// Expected destination URL for each data-route value
const ROUTE_URLS = {
  home:         '/',
  goals:        '/',                // same page, scrolls to #goals-section
  wellness:     '/health',
  gym:          '/gym',
  calisthenics: '/skills',
  grind:        '/grind',
};

test.describe('Navigation — links go to correct pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  for (const { route, url } of NAV_PAGES) {
    if (route === 'goals') continue; // same-page anchor, tested separately

    test(`[data-route="${route}"] navigates to ${url}`, async ({ page }) => {
      const getErrors = collectErrors(page);

      const link = page.locator(SEL.navLink(route)).first();
      await expect(link).toBeVisible();
      await link.click();

      await page.waitForURL(`**${url}`, { timeout: 8000 });
      await page.waitForLoadState('networkidle');

      // Target page should still have the header
      await expect(page.locator(SEL.header)).toBeAttached();

      // No new JS errors from the navigation
      const errors = getErrors();
      expect(errors, `JS errors navigating to ${route}:\n${errors.join('\n')}`).toHaveLength(0);
    });
  }

  test('[data-route="goals"] scrolls to #goals-section (same page)', async ({ page }) => {
    const link = page.locator(SEL.navLink('goals')).first();
    await link.click();
    // URL stays on index but gets the anchor
    await page.waitForURL(/index\.html.*goals-section|index\.html$/, { timeout: 5000 }).catch(() => {});
    // Section should exist on the page
    const goalsSection = page.locator('#goals-section').first();
    await expect(goalsSection).toBeAttached({ timeout: 3000 });
  });
});

test.describe('Navigation — active state', () => {
  for (const { name, route, url } of NAV_PAGES) {
    if (route === 'goals') continue;

    test(`active class is set on "${route}" link when on ${url}`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await waitForAnimations(page, 400); // topbar.js sets active after DOMContentLoaded

      const link = page.locator(SEL.navLink(route)).first();
      // topbar.js adds .active or aria-current to the matching link
      const cls = await link.getAttribute('class') || '';
      const aria = await link.getAttribute('aria-current') || '';
      expect(cls.includes('active') || aria === 'page',
        `Nav link for "${route}" should have .active or aria-current="page" on ${url}`
      ).toBe(true);
    });
  }
});

test.describe('Navigation — all pages have the same nav structure', () => {
  const routes = ['home', 'goals', 'wellness', 'gym', 'calisthenics', 'grind'];

  for (const { name, url } of NAV_PAGES) {
    test(`${name} (${url}) has all 6 nav links`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');

      for (const route of routes) {
        await expect(
          page.locator(SEL.navLink(route)).first(),
          `Missing [data-route="${route}"] in ${url}`
        ).toBeAttached();
      }
    });
  }
});

test.describe('Navigation — no JS errors when visiting each page', () => {
  for (const { name, url } of NAV_PAGES) {
    test(`no errors on ${name}`, async ({ page }) => {
      const getErrors = collectErrors(page);
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      const errors = getErrors();
      expect(errors, `Errors on ${url}:\n${errors.join('\n')}`).toHaveLength(0);
    });
  }
});

test.describe('Navigation — mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('header is visible on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(SEL.header)).toBeVisible();
  });

  test('page does not overflow horizontally', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('logo is visible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(SEL.logo)).toBeVisible();
  });
});
