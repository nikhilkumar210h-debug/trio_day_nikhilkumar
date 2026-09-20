const { test, expect } = require('@playwright/test');

test.describe('Trio Day QA Audit - Debug', () => {
  test('Load index.html and check ALL console messages', async ({ page }) => {
    const allMessages = [];
    page.on('console', msg => {
      allMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      allMessages.push({ type: 'pageerror', text: err.message });
    });

    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000); // Wait longer for modules

    console.log('=== ALL CONSOLE MESSAGES ===');
    allMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));
    
    // Check DOM
    const html = await page.content();
    console.log('=== PAGE HTML (first 5000 chars) ===');
    console.log(html.substring(0, 5000));
  });

  test('Check discover page console', async ({ page }) => {
    const allMessages = [];
    page.on('console', msg => {
      allMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      allMessages.push({ type: 'pageerror', text: err.message });
    });

    await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    console.log('=== DISCOVER CONSOLE MESSAGES ===');
    allMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));
    
    const html = await page.content();
    console.log('=== DISCOVER HTML (first 5000 chars) ===');
    console.log(html.substring(0, 5000));
  });

  test('Check build page console', async ({ page }) => {
    const allMessages = [];
    page.on('console', msg => {
      allMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      allMessages.push({ type: 'pageerror', text: err.message });
    });

    await page.goto('http://localhost:5500/build.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    console.log('=== BUILD CONSOLE MESSAGES ===');
    allMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));
    
    const html = await page.content();
    console.log('=== BUILD HTML (first 5000 chars) ===');
    console.log(html.substring(0, 5000));
  });
});