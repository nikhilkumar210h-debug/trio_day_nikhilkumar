const { test, expect } = require('@playwright/test');

test.describe('Debug specific issues', () => {
  test('Check tasks.html load and console', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      errors.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      errors.push({ type: 'pageerror', text: err.message });
    });
    page.on('response', resp => {
      if (resp.status() >= 400) {
        errors.push({ type: 'network', text: `${resp.status()} ${resp.url()}` });
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/tasks.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    console.log('=== TASKS.HTML CONSOLE ===');
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`));

    const html = await page.content();
    console.log('=== TASKS.HTML (first 5000) ===');
    console.log(html.substring(0, 5000));

    // Check for do-grid
    const doGrid = page.locator('.do-grid');
    const count = await doGrid.count();
    console.log('do-grid count:', count);
    if (count > 0) {
      const html = await doGrid.innerHTML();
      console.log('do-grid innerHTML:', html.substring(0, 1000));
    }
  });

  test('Check build.html forge-lane module', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      errors.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      errors.push({ type: 'pageerror', text: err.message });
    });
    page.on('response', resp => {
      if (resp.status() >= 400) {
        errors.push({ type: 'network', text: `${resp.status()} ${resp.url()}` });
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/build.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    console.log('=== BUILD.HTML CONSOLE ===');
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`));

    const html = await page.content();
    console.log('=== BUILD.HTML (first 5000) ===');
    console.log(html.substring(0, 5000));

    // Check for forge-grid
    const forgeGrid = page.locator('#forgeList');
    const count = await forgeGrid.count();
    console.log('forgeList count:', count);
    if (count > 0) {
      const html = await forgeGrid.innerHTML();
      console.log('forgeList innerHTML:', html.substring(0, 2000));
    }

    // Check if forge-lane.js loaded
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.src || s.type);
    });
    console.log('Scripts:', scripts.filter(s => s.includes('forge') || s.includes('activity')));
  });

  test('Check forge-lane.js network load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      errors.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      errors.push({ type: 'pageerror', text: err.message });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/forge-lane.js', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const content = await page.textContent('body') || await page.textContent('pre') || '';
    console.log('forge-lane.js content (first 2000):', content.substring(0, 2000));
  });

  test('Navigation click debug', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      errors.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      errors.push({ type: 'pageerror', text: err.message });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Discover first
    console.log('Clicking Discover...');
    await page.click('[data-nav="discover"]');
    await page.waitForTimeout(3000);
    console.log('URL after Discover:', page.url());

    // Click Do
    console.log('Clicking Do...');
    await page.click('[data-nav="do"]');
    await page.waitForTimeout(5000);
    console.log('URL after Do:', page.url());

    console.log('=== NAV CONSOLE ===');
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`));
  });
});