const { test, expect } = require('@playwright/test');

test.describe('Trio Day QA Audit', () => {
  test.describe.configure({ mode: 'parallel' });
  test('Load index.html (mobile) and check for console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // Set mobile viewport FIRST
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('Console errors on index.html:', errors);
    
    // Check basic elements - bottom-nav should be visible on mobile
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect(page.locator('[data-nav="today"]')).toHaveClass(/active/);
    
    // Check for JS module errors (blank page check)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('Navigate to all pages via bottom nav (mobile)', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    // Set mobile viewport FIRST
    await page.setViewportSize({ width: 390, height: 844 });
    
    // Today
    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('Today errors:', errors.filter(e => !e.includes('favicon')));

    // Discover
    await page.click('[data-nav="discover"]');
    await page.waitForURL('**/all-users.html');
    await page.waitForTimeout(2000);
    console.log('Discover errors:', errors.filter(e => !e.includes('favicon')));

    // Do
    await page.click('[data-nav="do"]');
    await page.waitForURL('**/tasks.html');
    await page.waitForTimeout(2000);
    console.log('Do errors:', errors.filter(e => !e.includes('favicon')));

    // Chat
    await page.click('[data-nav="chat"]');
    await page.waitForURL('**/chat.html');
    await page.waitForTimeout(2000);
    console.log('Chat errors:', errors.filter(e => !e.includes('favicon')));

    // You (Profile) - redirects to login since protected
    await page.waitForSelector('[data-nav="you"]', { state: 'visible', timeout: 10000 });
    await page.click('[data-nav="you"]');
    await page.waitForURL('**/login.html**');
    await page.waitForTimeout(2000);
    console.log('Profile redirect errors:', errors.filter(e => !e.includes('favicon') && !e.includes('already declared')));
  });

  test('Login flow', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('http://localhost:5500/login.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Check login form elements
    await expect(page.locator('#emailForm')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#googleBtn')).toBeVisible();
    
    // Test invalid email
    await page.fill('#email', 'invalid');
    await page.fill('#password', 'password');
    await page.click('#emailSubmitBtn');
    await page.waitForTimeout(500);
    const status = await page.locator('#authFormStatus').textContent();
    console.log('Invalid email status:', status);
    
    // Test invalid password (valid email format)
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'wrong');
    await page.click('#emailSubmitBtn');
    await page.waitForTimeout(2000);
    const status2 = await page.locator('#authFormStatus').textContent();
    console.log('Wrong password status:', status2);
    
    console.log('Login errors:', errors.filter(e => !e.includes('favicon')));
  });

  test('Discover page - four lanes only (mobile)', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Check four lane cards
    await expect(page.locator('.discover-lane-card')).toHaveCount(4);
    
    // Check lane labels
    const lanes = await page.locator('.lane-copy strong').allTextContents();
    console.log('Discover lanes:', lanes);
    
    // Should be Build, Learn, Challenge, Puzzle (not Game)
    expect(lanes).toContain('Build');
    expect(lanes).toContain('Learn');
    expect(lanes).toContain('Challenge');
    expect(lanes).toContain('Puzzle');
    expect(lanes).not.toContain('Game');
    
    console.log('Discover errors:', errors.filter(e => !e.includes('favicon')));
  });

  test('Activity pages load correctly (mobile)', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });

    // Test Build lane
    await page.goto('http://localhost:5500/build.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await expect(page.locator('#forgeList')).toBeVisible();
    console.log('Build page errors:', errors.filter(e => !e.includes('favicon')));

    // Test Learn lane
    await page.goto('http://localhost:5500/learn.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await expect(page.locator('#forgeList')).toBeVisible();
    console.log('Learn page errors:', errors.filter(e => !e.includes('favicon')));

    // Test Challenge lane
    await page.goto('http://localhost:5500/challenge.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await expect(page.locator('#forgeList')).toBeVisible();
    console.log('Challenge page errors:', errors.filter(e => !e.includes('favicon')));
  });

  test('Activity detail page loads', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });

    // Try loading a puzzle activity
    await page.goto('http://localhost:5500/activity.html?id=p1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    const url = page.url();
    console.log('Activity page URL:', url);
    
    // Check if it's login or activity page
    if (url.includes('login')) {
      console.log('Redirected to login as expected');
    } else {
      await expect(page.locator('#activityTitle')).toBeVisible();
      const title = await page.locator('#activityTitle').textContent();
      console.log('Activity title:', title);
    }
    
    console.log('Activity detail errors:', errors.filter(e => !e.includes('favicon')));
  });

  test('Rooms page loads (mobile)', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/rooms.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log('Rooms page URL:', url);
    
    console.log('Rooms errors:', errors.filter(e => !e.includes('favicon')));
  });

  test('Theme toggle works (mobile)', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check initial theme
    const initialTheme = await page.getAttribute('html', 'data-theme');
    console.log('Initial theme:', initialTheme);

    // Find and click theme toggle in header
    const themeBtn = page.locator('#headerThemeBtn');
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      await page.waitForTimeout(500);
      const newTheme = await page.getAttribute('html', 'data-theme');
      console.log('New theme:', newTheme);
      expect(newTheme).not.toBe(initialTheme);
    } else {
      console.log('Theme button not found in header');
      // Check if theme toggle exists in rail (desktop only)
    }

    console.log('Theme errors:', errors.filter(e => !e.includes('favicon')));
  });

  test('Mobile responsive - 390px width', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check bottom nav is visible
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect(page.locator('.nkm-create-fab')).toBeVisible();
    
    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(390);
    
    console.log('Mobile 390px errors:', errors.filter(e => !e.includes('favicon')));
  });

  test('Desktop responsive - 1280px width', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check desktop rail is visible
    await expect(page.locator('.nkm-rail')).toBeVisible();
    // bottom-nav should be hidden on desktop
    await expect(page.locator('.bottom-nav')).toBeHidden();
    
    console.log('Desktop 1280px errors:', errors.filter(e => !e.includes('favicon')));
  });
});