/**
 * playwright.config.js — Trio Day browser audit configuration.
 *
 * The audit runs against the local static server (`node server.js`), which
 * serves public/ on http://127.0.0.1:5500. Start it before running the tests.
 *
 *   node server.js
 *   npx playwright test
 */
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['qa-audit.spec.js'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:5500',
    headless: true,
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  }
});
