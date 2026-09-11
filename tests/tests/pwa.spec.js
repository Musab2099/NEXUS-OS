/**
 * NEXUS-OS — PWA Tests
 *
 * Service worker: sw.js, CACHE_VERSION = 'nexus-v16'
 * manifest.json: background_color #0A0813, theme_color #07051A (slightly different — leave both)
 * meta theme-color: #07051A
 */

import { test, expect } from '@playwright/test';

test.describe('PWA — Service Worker', () => {
  test('sw.js returns 200 and is non-empty', async ({ page }) => {
    const res = await page.goto('/sw.js');
    expect(res?.status()).toBe(200);
    const text = await res?.text();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('sw.js contains a CACHE_VERSION string', async ({ page }) => {
    const res = await page.goto('/sw.js');
    const text = await res?.text() || '';
    expect(text).toMatch(/CACHE_VERSION|nexus-v/i);
  });

  test('service worker registers on page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // SW registration is async

    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(registered).toBe(true);
  });

  test('no SW-related console errors on load', async ({ page }) => {
    const swErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && (
        m.text().includes('ServiceWorker') ||
        m.text().includes('sw.js') ||
        m.text().includes('service worker')
      )) swErrors.push(m.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(swErrors, `SW errors:\n${swErrors.join('\n')}`).toHaveLength(0);
  });
});

test.describe('PWA — Manifest', () => {
  let manifest;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const res = await page.goto('/manifest.json');
    manifest = await res?.json().catch(() => null);
    await page.close();
  });

  test('manifest.json is valid JSON', () => {
    expect(manifest).not.toBeNull();
  });

  test('has name or short_name', () => {
    expect(manifest?.name || manifest?.short_name).toBeTruthy();
  });

  test('has start_url', () => {
    expect(manifest?.start_url).toBeTruthy();
  });

  test('display is standalone or fullscreen', () => {
    expect(['standalone', 'fullscreen']).toContain(manifest?.display);
  });

  test('has a 192x192 icon', () => {
    const has192 = manifest?.icons?.some((i) => i.sizes === '192x192');
    expect(has192).toBe(true);
  });

  test('has a 512x512 icon', () => {
    const has512 = manifest?.icons?.some((i) => i.sizes === '512x512');
    expect(has512).toBe(true);
  });

  test('theme_color is set', () => {
    expect(manifest?.theme_color).toBeTruthy();
  });

  test('background_color is dark (#0A0813 or similar)', () => {
    // Must be a dark colour — not white/grey
    expect(manifest?.background_color).toMatch(/^#0|^rgb\(0|^hsl/i);
  });
});

test.describe('PWA — HTML meta tags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has <link rel="manifest">', async ({ page }) => {
    await expect(page.locator('link[rel="manifest"]')).toBeAttached();
  });

  test('has viewport meta tag', async ({ page }) => {
    await expect(page.locator('meta[name="viewport"]')).toBeAttached();
  });

  test('has theme-color meta tag', async ({ page }) => {
    await expect(page.locator('meta[name="theme-color"]')).toBeAttached();
  });

  test('theme-color meta is a dark colour', async ({ page }) => {
    const content = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(content).toBeTruthy();
    // Should not be white or a light colour — dark theme meta
    expect(content).not.toMatch(/^#[fF]{3,6}$|^white|rgb\(255/);
  });
});

test.describe('PWA — Icon files accessible', () => {
  test('referenced icon files return < 400', async ({ page }) => {
    const res = await page.goto('/manifest.json');
    const manifest = await res?.json().catch(() => ({ icons: [] }));
    const icons = (manifest?.icons || []).slice(0, 4); // check first 4

    for (const icon of icons) {
      const iconRes = await page.goto(icon.src);
      expect(
        iconRes?.status(),
        `Icon ${icon.src} → ${iconRes?.status()}`
      ).toBeLessThan(400);
    }
  });
});
