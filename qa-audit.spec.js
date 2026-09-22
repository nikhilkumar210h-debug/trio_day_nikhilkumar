const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 }
];

const PUBLIC_PAGES = [
  { path: '/', nav: 'today' },
  { path: '/all-users.html', nav: 'discover' },
  { path: '/challenge.html', nav: 'challenge' },
];

test.describe('Trio Day current product QA', () => {
  for (const viewport of VIEWPORTS) {
    for (const pageInfo of PUBLIC_PAGES) {
      test(`${viewport.name} — ${pageInfo.path} primary navigation`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`http://localhost:5500${pageInfo.path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(700);

        const navKeys = await page.locator('.bottom-nav [data-nav], .nkm-rail [data-rail]').evaluateAll(
          els => els.map(el => el.dataset.nav || el.dataset.rail)
        );

        expect(navKeys).toEqual(expect.arrayContaining(['today', 'discover', 'challenge', 'chat', 'you']));
        expect(navKeys).not.toContain('do');
        expect(navKeys).not.toContain('create');
        expect(navKeys).not.toContain('rooms');

        const active = await page.locator(`.nav-btn[data-nav="${pageInfo.nav}"], .nav-btn[data-rail="${pageInfo.nav}"]`).count();
        expect(active).toBeGreaterThan(0);

        const width = await page.evaluate(() => document.body.scrollWidth);
        expect(width).toBeLessThanOrEqual(viewport.width);
      });
    }
  }

  test('Discover contains only current product lanes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'domcontentloaded' });

    const body = await page.locator('body').textContent();
    expect(body).toContain('Challenges');
    expect(body).toContain('Connect');
    expect(body).toContain('Create');
    expect(body).not.toContain('Forge');
    expect(body).not.toContain('Live Rooms');
    expect(body).not.toContain('Build');
    expect(body).not.toContain('Learn');
    expect(body).not.toContain('Puzzle');
  });

  test('Challenge creation route exists', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/challenge-create.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#question')).toBeVisible();
    await expect(page.locator('#publish')).toBeVisible();
  });

  test('Retired routes are absent', async ({ request }) => {
    for (const path of [
      '/tasks.html',
      '/task-create.html',
      '/task-detail.html',
      '/view_post.html',
      '/rooms.html',
      '/room.html',
      '/build.html',
      '/learn.html',
      '/puzzle.html',
      '/game.html'
    ]) {
      const response = await request.get(`http://localhost:5500${path}`);
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });
});
