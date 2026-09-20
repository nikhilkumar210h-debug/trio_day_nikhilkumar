const { test, expect } = require('@playwright/test');

test.describe('Debug specific pages', () => {
  test('Direct load all-users.html and check console', async ({ page }) => {
    const errors = [];
    page.on('console', msg => errors.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => errors.push({ type: 'pageerror', text: err.message }));
    page.on('response', resp => {
      if (resp.status() >= 400) errors.push({ type: 'network', text: `${resp.status()} ${resp.url()}` });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(8000);

    console.log('=== ALL-USERS.HTML CONSOLE ===');
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`));

    const html = await page.content();
    console.log('=== ALL-USERS.HTML (first 8000) ===');
    console.log(html.substring(0, 8000));

    // Check for discover-lane-card
    const cards = page.locator('.discover-lane-card');
    const count = await cards.count();
    console.log('discover-lane-card count:', count);
  });

  test('Direct load build.html and check console', async ({ page }) => {
    const errors = [];
    page.on('console', msg => errors.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => errors.push({ type: 'pageerror', text: err.message }));
    page.on('response', resp => {
      if (resp.status() >= 400) errors.push({ type: 'network', text: `${resp.status()} ${resp.url()}` });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/build.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(8000);

    console.log('=== BUILD.HTML CONSOLE ===');
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`));

    const html = await page.content();
    console.log('=== BUILD.HTML (first 8000) ===');
    console.log(html.substring(0, 8000));

    // Check for forgeList
    const forgeList = page.locator('#forgeList');
    const count = await forgeList.count();
    console.log('forgeList count:', count);
    if (count > 0) {
      const inner = await forgeList.innerHTML();
      console.log('forgeList innerHTML:', inner.substring(0, 1000));
    }
  });

  test('Check chat.html bottom nav for profile link', async ({ page }) => {
    const errors = [];
    page.on('console', msg => errors.push({ type: msg.type(), text: msg.text() }));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/chat.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    console.log('=== CHAT.HTML CONSOLE ===');
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`));

    const html = await page.content();
    console.log('=== CHAT.HTML (first 8000) ===');
    console.log(html.substring(0, 8000));

    // Check bottom nav items
    const navItems = await page.locator('.bottom-nav [data-nav]').all();
    console.log('Bottom nav items count:', navItems.length);
    for (const item of navItems) {
      const nav = await item.getAttribute('data-nav');
      const href = await item.getAttribute('href');
      console.log(`  Nav: ${nav}, href: ${href}`);
    }
  });
});