const { test, expect } = require('@playwright/test');

const ADMIN_USER = {
  email: 'nikhilkumar210h@gmail.com',
  displayName: 'QA Admin',
  getIdToken: async () => 'qa-test-token'
};

async function mockAdminModules(page) {
  const emptyModule = { status: 200, contentType: 'application/javascript', body: '' };
  for (const path of [
    '**/auth-preload.js*', '**/auth-guard.js*', '**/auth-ui.js*',
    '**/theme.js*', '**/ui/header.js*', '**/ui/subnav.js*',
    '**/ui/sheet.js*', '**/ui/sound.js*'
  ]) {
    await page.route(path, route => route.fulfill(emptyModule));
  }

  await page.route('**/firebase-init.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `const user = { email: 'nikhilkumar210h@gmail.com', displayName: 'QA Admin', getIdToken: async () => 'qa-test-token' }; export const auth = { currentUser: user }; export const db = {};`
  }));
  await page.route('**/firebase-auth.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `const user = { email: 'nikhilkumar210h@gmail.com', displayName: 'QA Admin', getIdToken: async () => 'qa-test-token' }; export function onAuthStateChanged(_auth, callback) { queueMicrotask(() => callback(user)); return () => {}; }`
  }));
  await page.route('**/sound-manager.js*', route => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: 'export const SoundManager = { init() {}, play() {} };'
  }));
  await page.route('**/utils.js*', route => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `export function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }`
  }));
  await page.route('**/ui/nav.js*', route => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: 'export function setAdminFlag() {}'
  }));
}

async function mockAdminApi(page) {
  const activities = [{
    id: 'activity-1', display_order: 0, category: 'Starter',
    title_en: 'Starter activity', title_hi: '', description_en: 'A short starter activity',
    description_hi: '', difficulty: 'Easy', total_xp: 25, cover_image_url: null,
    is_guest_allowed: true, is_published: true, created_at: '2026-10-19T00:00:00Z'
  }];
  const tasks = [{
    id: 'task-1', activity_id: 'activity-1', task_number: 1, task_type: 'Learning Sprint',
    title_en: 'Learn one concept', title_hi: '', description_en: 'Study one concept',
    instructions_en: 'Explain it in your own words and give one example.',
    instructions_hi: 'Apne shabdon mein samjhayen aur ek example dein.',
    min_time_seconds: 0, xp_reward: 25, verification_prompt: 'Check for a clear example.',
    is_published: true, created_at: '2026-10-19T00:00:00Z', updated_at: '2026-10-19T00:00:00Z'
  }];
  const calls = [];

  await page.route('https://trio-day.trioday-nikhil.workers.dev/api/admin/**', async route => {
    const url = new URL(route.request().url());
    const payload = route.request().postDataJSON() || {};
    calls.push({ path: url.pathname, payload });

    if (url.pathname.endsWith('/cloudinary-sign')) {
      return route.fulfill({ json: {
        uploadUrl: 'https://api.cloudinary.com/v1_1/mock/image/upload',
        signature: 'qa-signature', timestamp: 123456, apiKey: 'qa-key',
        publicId: 'trio/activities/qa-cover'
      }});
    }

    if (url.pathname.endsWith('/activity')) {
      if (payload.action === 'list') return route.fulfill({ json: activities });
      if (payload.action === 'create') {
        const item = { id: `activity-${Date.now()}`, ...payload.data };
        activities.push(item);
        return route.fulfill({ json: [item] });
      }
      if (payload.action === 'update') {
        const index = activities.findIndex(item => item.id === payload.activityId);
        if (index >= 0) activities[index] = { ...activities[index], ...payload.data };
        return route.fulfill({ json: index >= 0 ? [activities[index]] : [] });
      }
      if (payload.action === 'delete') {
        const index = activities.findIndex(item => item.id === payload.activityId);
        if (index >= 0) activities.splice(index, 1);
        for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].activity_id === payload.activityId) tasks.splice(i, 1);
        return route.fulfill({ json: { ok: true } });
      }
    }

    if (url.pathname.endsWith('/task')) {
      if (payload.action === 'list') {
        const result = payload.activityId ? tasks.filter(task => task.activity_id === payload.activityId) : tasks;
        return route.fulfill({ json: result });
      }
      if (payload.action === 'create') {
        const item = { id: `task-${Date.now()}`, ...payload.data };
        tasks.push(item);
        return route.fulfill({ json: [item] });
      }
      if (payload.action === 'update') {
        const index = tasks.findIndex(item => item.id === payload.taskId);
        if (index >= 0) tasks[index] = { ...tasks[index], ...payload.data };
        return route.fulfill({ json: index >= 0 ? [tasks[index]] : [] });
      }
      if (payload.action === 'delete') {
        const index = tasks.findIndex(item => item.id === payload.taskId);
        if (index >= 0) tasks.splice(index, 1);
        return route.fulfill({ json: { ok: true } });
      }
    }
    return route.fulfill({ status: 400, json: { error: 'Unexpected QA request' } });
  });

  await page.route('https://api.cloudinary.com/v1_1/mock/image/upload', route => route.fulfill({
    json: {
      secure_url: 'https://res.cloudinary.com/mock/image/upload/v1/trio/activities/qa-cover.png',
      public_id: 'trio/activities/qa-cover'
    }
  }));

  return { activities, tasks, calls };
}

test('sign-in page is readable and usable on a narrow screen', async ({ page }) => {
  await page.route('**/auth.js*', route => route.fulfill({
    status: 200, contentType: 'application/javascript', body: ''
  }));
  await page.route('**/theme.js*', route => route.fulfill({
    status: 200, contentType: 'application/javascript', body: ''
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Sign in — Trio Day/);
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('#emailSubmitBtn')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('admin activity buttons, task CRUD, filters and mobile layout work with mocked auth/API', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await mockAdminModules(page);
  const backend = await mockAdminApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin-activity.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#adminPanel')).toBeVisible();
  await expect(page.locator('.task-list-item')).toHaveCount(1);
  await page.locator('#refreshActivities').click();
  await expect(page.locator('.task-list-item')).toHaveCount(1);

  // Activity creation, including the signed-upload path.
  await page.locator('[data-tab="create-activity"]').click();
  await page.locator('#actTitle').fill('Career starter pack');
  await page.locator('#actCategory').selectOption('Career & Practical Life');
  await page.locator('#actDifficulty').selectOption('Medium');
  await page.locator('#actXpReward').fill('75');
  await page.locator('#actCoverFile').setInputFiles({
    name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('qa-image')
  });
  await expect(page.locator('#actCoverUrl')).toHaveValue(/res\.cloudinary\.com/);
  await page.locator('#activityForm button[type="submit"]').click();
  await expect(page.locator('.task-list-item').filter({ hasText: 'Career starter pack' })).toBeVisible();

  const createdActivity = backend.activities.find(item => item.title_en === 'Career starter pack');
  expect(createdActivity).toBeTruthy();

  // Task creation from an editable template, with the chosen activity and order saved.
  await page.locator('[data-tab="tasks"]').click();
  await page.locator('#filterActivity').selectOption(createdActivity.id);
  await page.locator('#createTaskBtn').click();
  await expect(page.locator('#taskModal')).toBeVisible();
  await page.locator('#taskTemplate').selectOption('learning');
  await page.locator('#taskOrder').fill('2');
  await page.locator('#taskActivityPicker').selectOption(createdActivity.id);
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('.task-list-item')).toHaveCount(1);
  const createdTask = backend.tasks.find(item => item.activity_id === createdActivity.id);
  expect(createdTask).toBeTruthy();
  expect(createdTask.task_number).toBe(2);
  expect(createdTask.verification_prompt).toBeTruthy();

  // Edit, filter, cancel/close and delete task actions.
  await page.locator(`.edit-task[data-id="${createdTask.id}"]`).click();
  await expect(page.locator('#taskModal')).toBeVisible();
  await expect(page.locator('#taskForm button[type="submit"]')).toHaveText(/Update Task/);
  await page.locator('#taskTitle').fill('Updated learning task');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('.task-list-item')).toContainText('Updated learning task');

  await page.locator('#createTaskBtn').click();
  await page.locator('#taskModalClose').click();
  await expect(page.locator('#taskModal')).toBeHidden();
  await page.locator('#createTaskBtn').click();
  await page.locator('#cancelTask').click();
  await expect(page.locator('#taskModal')).toBeHidden();

  page.once('dialog', dialog => dialog.accept());
  await page.locator(`.delete-task[data-id="${createdTask.id}"]`).click();
  await expect(page.locator('.task-list-item')).toHaveCount(0);

  // Activity edit/delete and the category selector/filter must keep working.
  await page.locator('[data-tab="activities"]').click();
  await page.locator(`.edit-activity[data-id="${createdActivity.id}"]`).click();
  await page.locator('#actTitle').fill('Updated career pack');
  await page.locator('#activityForm button[type="submit"]').click();
  await expect(page.locator('.task-list-item')).toContainText('Updated career pack');
  page.once('dialog', dialog => dialog.accept());
  await page.locator(`.delete-activity[data-id="${createdActivity.id}"]`).click();
  await expect(page.locator('.task-list-item').filter({ hasText: 'Updated career pack' })).toHaveCount(0);

  expect(backend.calls.some(call => call.path.endsWith('/task') && call.payload.action === 'list' && call.payload.activityId === createdActivity.id)).toBe(true);
  expect(backend.calls.some(call => call.path.endsWith('/cloudinary-sign'))).toBe(true);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
