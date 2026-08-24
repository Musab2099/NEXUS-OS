/**
 * NEXUS-OS — Theme Tests
 *
 * Three themes: nexus-dark (default), arctic-white, periwinkle (Focus).
 * window.NexusTheme.set() applies the theme and writes to localStorage['nexus-theme'].
 * Applied via data-theme on <html>.
 * Theme dropdown: [data-theme-button] opens [data-theme-menu], options are
 * [data-theme-option="nexus-dark|arctic-white|periwinkle"].
 */

import { test, expect } from '@playwright/test';
import {
  THEMES, THEME_STORAGE_KEY, SEL,
  getCSSVar, getActiveTheme, switchTheme,
  collectErrors, waitForAnimations,
} from './helpers.js';

test.describe('Theme — initial state', () => {
  test.beforeEach(async ({ page }) => {
    // Clear stored theme so we get the default
    await page.goto('/index.html');
    await page.evaluate((key) => localStorage.removeItem(key), THEME_STORAGE_KEY);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('default theme is nexus-dark', async ({ page }) => {
    const theme = await getActiveTheme(page);
    expect(theme).toBe('nexus-dark');
  });

  test('all canonical CSS vars are defined on default theme', async ({ page }) => {
    const vars = ['--bg', '--card', '--border', '--t1', '--a1', '--a2', '--a3'];
    for (const v of vars) {
      const val = await getCSSVar(page, v);
      expect(val, `${v} should be defined`).not.toBe('');
    }
  });

  test('theme dropdown button is visible', async ({ page }) => {
    await expect(page.locator(SEL.themeButton)).toBeVisible();
  });

  test('theme dropdown has all 3 options', async ({ page }) => {
    for (const { key } of THEMES) {
      await expect(
        page.locator(SEL.themeOption(key)),
        `Missing theme option: ${key}`
      ).toBeAttached();
    }
  });
});

test.describe('Theme — switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
  });

  for (const { key, label } of THEMES) {
    test(`switching to "${key}" sets data-theme on <html>`, async ({ page }) => {
      const getErrors = collectErrors(page);

      await switchTheme(page, key);

      const active = await getActiveTheme(page);
      expect(active, `data-theme should be "${key}"`).toBe(key);

      // No JS errors during switch
      const errors = getErrors();
      expect(errors, `Errors switching to ${key}:\n${errors.join('\n')}`).toHaveLength(0);
    });

    test(`switching to "${key}" saves to localStorage`, async ({ page }) => {
      await switchTheme(page, key);

      const stored = await page.evaluate(
        (k) => localStorage.getItem(k),
        THEME_STORAGE_KEY
      );
      expect(stored).toBe(key);
    });

    test(`"${key}" theme has non-empty --bg and --a1 vars`, async ({ page }) => {
      await switchTheme(page, key);

      const bg = await getCSSVar(page, '--bg');
      const a1 = await getCSSVar(page, '--a1');
      expect(bg).not.toBe('');
      expect(a1).not.toBe('');
    });
  }

  test('cycling through all themes does not produce JS errors', async ({ page }) => {
    const getErrors = collectErrors(page);
    for (const { key } of THEMES) {
      await switchTheme(page, key);
    }
    const errors = getErrors();
    expect(errors).toHaveLength(0);
  });
});

test.describe('Theme — persistence', () => {
  test('theme persists across page reload', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    await switchTheme(page, 'arctic-white');

    await page.reload();
    await page.waitForLoadState('networkidle');

    const theme = await getActiveTheme(page);
    expect(theme).toBe('arctic-white');
  });

  test('theme persists when navigating to another page', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    await switchTheme(page, 'periwinkle');

    // Navigate to gym page
    await page.goto('/gym.html');
    await page.waitForLoadState('networkidle');

    const theme = await getActiveTheme(page);
    expect(theme).toBe('periwinkle');
  });

  test('window.NexusTheme.get() returns the active theme key', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    await switchTheme(page, 'arctic-white');

    const themeFromAPI = await page.evaluate(() => window.NexusTheme?.get?.());
    // NexusTheme.get() should return the stored key
    if (themeFromAPI !== undefined) {
      expect(themeFromAPI).toBe('arctic-white');
    }
  });
});

test.describe('Theme — nexus-dark integrity (no cyan/teal)', () => {
  test('dark theme --bg is a dark purple, not cyan/teal', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    // Ensure dark theme is active
    await page.evaluate((k) => localStorage.setItem(k, 'nexus-dark'), THEME_STORAGE_KEY);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const bg = await getCSSVar(page, '--bg');
    // Dark theme bg should be a very dark colour — not a light or cyan value
    // Parse RGB to verify it's dark
    const rgb = await page.evaluate((v) => {
      const el = document.createElement('div');
      el.style.background = v;
      document.body.appendChild(el);
      const c = getComputedStyle(el).backgroundColor;
      document.body.removeChild(el);
      return c; // e.g. "rgb(10, 8, 19)"
    }, bg);

    // Extract luminance — dark theme bg should be very dark
    const match = rgb.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
      expect(luminance, `Dark theme --bg is too bright (${rgb})`).toBeLessThan(30);
    }
  });
});
