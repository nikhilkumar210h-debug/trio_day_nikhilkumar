const { test, expect } = require('@playwright/test');

test.describe('Trio Day QA Audit - Debug 2', () => {
  test('Check index.html bottom-nav attributes', async ({ page }) => {
    const allMessages = [];
    page.on('console', msg => {
      allMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      allMessages.push({ type: 'pageerror', text: err.message });
    });

    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const bottomNav = page.locator('.bottom-nav');
    const hasHidden = await bottomNav.getAttribute('hidden');
    const classAttr = await bottomNav.getAttribute('class');
    const style = await bottomNav.getAttribute('style');
    const isVisible = await bottomNav.isVisible();
    const computedStyle = await bottomNav.evaluate(el => {
      const cs = getComputedStyle(el);
      return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, height: cs.height };
    });

    console.log('bottom-nav hidden attr:', hasHidden);
    console.log('bottom-nav class:', classAttr);
    console.log('bottom-nav style:', style);
    console.log('bottom-nav isVisible:', isVisible);
    console.log('bottom-nav computedStyle:', computedStyle);

    // Check nav-row
    const navRow = page.locator('.nav-row');
    const navRowHtml = await navRow.innerHTML();
    console.log('nav-row innerHTML:', navRowHtml);

    // Check if nav.js ran - look for nkm-create-fab
    const fab = page.locator('.nkm-create-fab');
    const fabCount = await fab.count();
    console.log('nkm-create-fab count:', fabCount);

    // Check if nkm-rail exists
    const rail = page.locator('.nkm-rail');
    const railCount = await rail.count();
    console.log('nkm-rail count:', railCount);

    console.log('=== ALL CONSOLE MESSAGES ===');
    allMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));
  });

  test('Check discover page with auth bypass', async ({ page }) => {
    // Add to localStorage to bypass auth check
    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.setItem('trio-test-bypass', 'true');
    });
    
    const allMessages = [];
    page.on('console', msg => {
      allMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      allMessages.push({ type: 'pageerror', text: err.message });
    });

    await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log('URL:', url);
    
    const html = await page.content();
    console.log('=== DISCOVER HTML (first 5000 chars) ===');
    console.log(html.substring(0, 5000));

    console.log('=== ALL CONSOLE MESSAGES ===');
    allMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));
  });
});