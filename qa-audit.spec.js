const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TRIO_DAY_BASE_URL || 'http://127.0.0.1:5500';

test('sign-in form remains usable on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  const overflowsHorizontally = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflowsHorizontally).toBe(false);
});

test('activity, admin and versioned JavaScript assets are served', async ({ request }) => {
  const paths = [
    '/index.html',
    '/login.html',
    '/admin-activity.html',
    '/activity-player.html',
    '/today-activity.js',
    '/admin-activity.js',
    '/activity-player.js',
    '/gamification/worker-config.js',
    '/styles/activity-motion.css'
  ];
  for (const path of paths) {
    const response = await request.get(`${BASE_URL}${path}`);
    expect(response.status(), `${path} should be served`).toBe(200);
  }
});

test('admin task controls and form fields have stable IDs and names', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/admin-activity.html`);
  const html = await response.text();
  expect(html).toContain('data-tab="create-activity"');
  expect(html).toContain('id="taskActivityPicker"');
  expect(html).toContain('name="task_number"');
  expect(html).toContain('id="refreshTasksBtn"');
  expect(html).toContain('id="taskModal"');
});

test('task completion uses protected Worker and honors rejection responses', async ({ request }) => {
  const [configResponse, playerResponse, workerResponse, adminResponse] = await Promise.all([
    request.get(`${BASE_URL}/gamification/worker-config.js`),
    request.get(`${BASE_URL}/activity-player.js`),
    request.get(`${BASE_URL}/../workers/gamification.js`),
    request.get(`${BASE_URL}/admin-activity.js`)
  ]);
  expect(configResponse.ok()).toBeTruthy();
  expect(playerResponse.ok()).toBeTruthy();
  expect(adminResponse.ok()).toBeTruthy();

  const config = await configResponse.text();
  const player = await playerResponse.text();
  const admin = await adminResponse.text();
  expect(config).toContain('https://trio-gamification.trioday-nikhil.workers.dev');
  expect(player).toContain('result.ok === false');
  expect(player).toContain('Number(result.awarded');
  expect(admin).toContain('getGamificationWorkerUrl()');
});
