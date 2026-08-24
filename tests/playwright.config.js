// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * NEXUS-OS Playwright Config
 *
 * NEXUS uses a build step: node scripts/build.js copies src/ → dist/.
 * The webServer runs `npm run dev` from the NEXUS root (one level up from tests/).
 *
 * Override the target URL for Vercel preview testing:
 *   BASE_URL=https://nexus-abc123.vercel.app npm test
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: ['**/smoke.spec.js', '**/navigation.spec.js'],
    },
  ],

  // Builds NEXUS and serves dist/ — skipped when BASE_URL is set (CI/Vercel)
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // Runs from the NEXUS repo root (parent of the tests/ folder)
        command: 'npm run dev',
        cwd: '../',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 20_000,
      },
});
