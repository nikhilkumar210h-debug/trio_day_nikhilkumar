const { test, expect } = require('@playwright/test');

test.describe('Verify server HTML without networkidle', () => {
  test('all-users.html - check static HTML', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const html = await page.content();
    console.log('=== ALL-USERS.HTML (first 5000) ===');
    console.log(html.substring(0, 5000));

    // Check for discover-lane-card in static HTML
    const hasLaneCards = html.includes('discover-lane-card');
    const hasForgeHero = html.includes('forge-brand-hero');
    console.log('Has discover-lane-card:', hasLaneCards);
    console.log('Has forge-brand-hero:', hasForgeHero);
  });

  test('build.html - check static HTML', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/build.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const html = await page.content();
    console.log('=== BUILD.HTML (first 5000) ===');
    console.log(html.substring(0, 5000));

    const hasForgeList = html.includes('id="forgeList"');
    const hasForgeHero = html.includes('forge-brand-hero');
    console.log('Has forgeList:', hasForgeList);
    console.log('Has forge-brand-hero:', hasForgeHero);
  });

  test('chat.html - should redirect to login', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/chat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const html = await page.content();
    const isLoginPage = html.includes('Sign in — Trio') || html.includes('auth-page');
    console.log('Chat.html redirects to login:', isLoginPage);
    console.log('URL:', page.url());
  });

  test('index.html - loads correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const html = await page.content();
    const hasBottomNav = html.includes('bottom-nav');
    const hasTopbar = html.includes('topbar');
    console.log('Index has bottom-nav:', hasBottomNav);
    console.log('Index has topbar:', hasTopbar);
    console.log('URL:', page.url());
  });
});