/**
 * NEXUS-OS — Module-Specific Tests
 *
 * Each module has its own HTML page. Tests go to the real URL and verify
 * the module renders its core UI. Data from localStorage is not seeded —
 * tests check structure, not data content.
 */

import { test, expect } from '@playwright/test';
import { collectErrors, waitForAnimations } from './helpers.js';

const SETTLE = 800; // ms after load to let JS render

// ─── Dashboard (index.html) ───────────────────────────────────────────────────

test.describe('Module — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, SETTLE);
  });

  test('bento grid or widget container is present', async ({ page }) => {
    const container = page.locator(
      '[class*="bento"], [class*="grid"], [class*="dashboard"], [class*="widget"]'
    ).first();
    await expect(container).toBeVisible({ timeout: 5000 });
  });

  test('at least one stat or card is visible', async ({ page }) => {
    const cards = page.locator('[class*="card"], [class*="glass"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('no JS errors on dashboard', async ({ page }) => {
    const getErrors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, SETTLE);
    expect(getErrors()).toHaveLength(0);
  });
});

// ─── Wellness / Health (health.html) ─────────────────────────────────────────

test.describe('Module — Wellness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/health.html');
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, SETTLE);
  });

  test('sleep, habit, or recovery section is present', async ({ page }) => {
    const keywords = ['sleep', 'habit', 'recovery', 'wellness', 'journal', 'dream'];
    let found = 0;
    for (const kw of keywords) {
      const el = page.locator(`text=/${kw}/i`).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) found++;
    }
    expect(found, 'Expected at least 2 wellness keywords to be visible').toBeGreaterThanOrEqual(2);
  });

  test('date input or today\'s date reference is present', async ({ page }) => {
    const dateEl = page.locator(
      'input[type="date"], [class*="date"], [class*="today"]'
    ).first();
    await expect(dateEl).toBeAttached({ timeout: 5000 });
  });

  test('no JS errors on health page', async ({ page }) => {
    const getErrors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(getErrors()).toHaveLength(0);
  });
});

// ─── Gym Tracker (gym.html) ──────────────────────────────────────────────────

test.describe('Module — Gym Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gym.html');
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, SETTLE);
  });

  test('4-day split labels are visible (A/B/C/D or Push/Pull/Legs/etc)', async ({ page }) => {
    const splitLabels = ['a', 'b', 'c', 'd', 'push', 'pull', 'legs', 'core', 'full'];
    let found = 0;
    for (const label of splitLabels) {
      const el = page.locator(`text=/\\b${label}\\b/i`).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) found++;
    }
    expect(found, 'Expected at least 2 split/day labels').toBeGreaterThanOrEqual(2);
  });

  test('exercise list or #exerciseList skeleton is present', async ({ page }) => {
    const list = page.locator('#exerciseList, [class*="exercise-list"], [class*="exercise"]').first();
    await expect(list).toBeAttached({ timeout: 5000 });
  });

  test('PR or measurements section exists', async ({ page }) => {
    const pr = page.locator(
      'text=/pr|personal record|1rm|measurements|weight/i'
    ).first();
    await expect(pr).toBeVisible({ timeout: 5000 });
  });

  test('no JS errors on gym page', async ({ page }) => {
    const getErrors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(getErrors()).toHaveLength(0);
  });
});

// ─── Calisthenics / Progression (progression-tab.html) ───────────────────────

test.describe('Module — Calisthenics Progression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/progression-tab.html');
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, SETTLE);
  });

  const SKILLS = ['planche', 'front lever', 'muscle.up', 'handstand', 'l.sit', 'back lever'];

  test('at least 4 of the 6 calisthenics skills are visible', async ({ page }) => {
    let found = 0;
    for (const skill of SKILLS) {
      const el = page.locator(`text=/${skill}/i`).first();
      if (await el.isVisible({ timeout: 800 }).catch(() => false)) found++;
    }
    expect(found, `Expected ≥4 skills, found ${found}`).toBeGreaterThanOrEqual(4);
  });

  test('skill progression elements are present (progress bar, level, or stage)', async ({ page }) => {
    const prog = page.locator(
      'progress, [class*="progress"], [class*="level"], [class*="stage"], [class*="skill-card"]'
    ).first();
    await expect(prog).toBeAttached({ timeout: 5000 });
  });

  test('no JS errors on calisthenics page', async ({ page }) => {
    const getErrors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(getErrors()).toHaveLength(0);
  });
});

// ─── Grind Log (grind-log.html) ──────────────────────────────────────────────

test.describe('Module — Grind Log', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/grind-log.html');
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, SETTLE);
  });

  test('XP or category labels are visible', async ({ page }) => {
    const labels = ['xp', 'focus', 'train', 'build', 'grind', 'log', 'session'];
    let found = 0;
    for (const l of labels) {
      const el = page.locator(`text=/${l}/i`).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) found++;
    }
    expect(found, 'Expected at least 2 grind log labels').toBeGreaterThanOrEqual(2);
  });

  test('add session button or input is present', async ({ page }) => {
    const btn = page.locator(
      'button, input[type="text"], [class*="add"], [class*="log-entry"]'
    ).first();
    await expect(btn).toBeAttached({ timeout: 5000 });
  });

  test('no JS errors on grind-log page', async ({ page }) => {
    const getErrors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(getErrors()).toHaveLength(0);
  });
});

// ─── FaceScan (facescan.html) ─────────────────────────────────────────────────

test.describe('Module — FaceScan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/facescan.html');
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, SETTLE);
  });

  test('scan UI element is present (button, input, or video)', async ({ page }) => {
    const ui = page.locator(
      'input[type="file"], video, button, [class*="scan"], [class*="capture"]'
    ).first();
    await expect(ui).toBeAttached({ timeout: 5000 });
  });

  test('result or output area is present', async ({ page }) => {
    const output = page.locator(
      '[class*="result"], [class*="output"], [class*="analysis"], [id*="result"]'
    ).first();
    await expect(output).toBeAttached({ timeout: 5000 });
  });

  test('camera does not auto-start on load (requires user action)', async ({ page }) => {
    await waitForAnimations(page, 1000);
    // An active media stream means camera auto-started without user consent
    const autoStarted = await page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      return Array.from(videos).some(v => v.srcObject !== null && !v.paused);
    });
    expect(autoStarted, 'Camera should not auto-start on page load').toBe(false);
  });

  test('no JS errors on facescan page', async ({ page }) => {
    const getErrors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(getErrors()).toHaveLength(0);
  });
});

// ─── Live Workout (live-workout.html) ────────────────────────────────────────

test.describe('Module — Live Workout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/live-workout.html');
    await page.waitForLoadState('networkidle');
    await waitForAnimations(page, SETTLE);
  });

  test('workout logger UI is present', async ({ page }) => {
    const ui = page.locator(
      '[class*="workout"], [class*="exercise"], [class*="timer"], [class*="set"], button'
    ).first();
    await expect(ui).toBeAttached({ timeout: 5000 });
  });

  test('rest timer element exists', async ({ page }) => {
    const timer = page.locator(
      '[class*="timer"], [class*="rest"], [class*="countdown"], [id*="timer"]'
    ).first();
    await expect(timer).toBeAttached({ timeout: 5000 });
  });

  test('NexusWorkoutStore is available on window', async ({ page }) => {
    const hasStore = await page.evaluate(() => typeof window.NexusWorkoutStore !== 'undefined');
    expect(hasStore, 'window.NexusWorkoutStore should be defined').toBe(true);
  });

  test('no JS errors on live-workout page', async ({ page }) => {
    const getErrors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(getErrors()).toHaveLength(0);
  });
});
