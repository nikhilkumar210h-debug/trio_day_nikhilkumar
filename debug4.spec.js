const { test, expect } = require('@playwright/test');

test.describe('Debug Discover and Navigation', () => {
  test('Direct load all-users.html (mobile)', async ({ page }) => {
    const errors = [];
    page.on('console', msg => errors.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => errors.push({ type: 'pageerror', text: err.message }));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    console.log('=== ALL-USERS.HTML CONSOLE ===');
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`));

    const html = await page.content();
    console.log('=== ALL-USERS.HTML (first 8000) ===');
    console.log(html.substring(0, 8000));

    // Check for discover-lane-card
    const cards = page.locator('.discover-lane-card');
    const count = await cards.count();
    console.log('discover-lane-card count:', count);
    
    if (count > 0) {
      const first = await cards.first().innerHTML();
      console.log('First card:', first.substring(0, 500));
    }

    // Check for forge-brand-hero
    const hero = page.locator('.forge-brand-hero');
    const heroCount = await hero.count();
    console.log('forge-brand-hero count:', heroCount);
  });

  test('Navigation from index.html step by step', async ({ page }) => {
    const errors = [];
    page.on('console', msg => errors.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => errors.push({ type: 'pageerror', text: err.message }));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('=== INITIAL INDEX.HTML ===');
    console.log('URL:', page.url());
    
    // Check bottom-nav links
    const links = await page.locator('.bottom-nav [data-nav]').all();
    for (const link of links) {
      const nav = await link.getAttribute('data-nav');
      const href = await link.getAttribute('href');
      console.log(`  Nav: ${nav}, href: ${href}`);
    }

    // Click Discover
    console.log('\nClicking Discover...');
    await page.click('[data-nav="discover"]');
    await page.waitForTimeout(3000);
    console.log('URL after Discover click:', page.url());

    const html = await page.content();
    console.log('Page title:', await page.title());
    console.log('First 3000 chars:', html.substring(0, 3000));

    // Click Do
    console.log('\nClicking Do...');
    await page.click('[data-nav="do"]');
    await page.waitForTimeout(3000);
    console.log('URL after Do click:', page.url());
    console.log('Page title:', await page.title());
  });
});