# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-audit.spec.js >> Trio Day QA Audit >> Navigate to all pages via bottom nav (mobile)
- Location: qa-audit.spec.js:33:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('[data-nav="you"]') to be visible

```

# Page snapshot

```yaml
- main [ref=f4e2]:
  - generic [ref=f4e3]:
    - region "Trio introduction" [ref=f4e4]:
      - link "Trio home" [ref=f4e5] [cursor=pointer]:
        - /url: index.html
        - img "Trio logo" [ref=f4e6]
        - generic [ref=f4e7]:
          - strong [ref=f4e8]: Trio
          - generic [ref=f4e9]: Play · Learn · Grow
      - heading "Make time worth sharing." [level=1] [ref=f4e10]: Make timeworth sharing.
      - paragraph [ref=f4e11]: Find activities, build with friends, solve puzzles and jump into live rooms without losing the flow.
      - generic [ref=f4e12]:
        - generic [ref=f4e13]:
          - text: 🧩
          - strong [ref=f4e14]: Solve
          - generic [ref=f4e15]: Quick puzzles and challenges.
        - generic [ref=f4e16]:
          - text: 🛠️
          - strong [ref=f4e17]: Build
          - generic [ref=f4e18]: Create things together.
    - generic [ref=f4e19]:
      - generic [ref=f4e20]:
        - heading "Welcome back" [level=2] [ref=f4e21]
        - paragraph [ref=f4e22]: Use email or your permanent Trio UID to sign in.
      - tablist "Account mode" [ref=f4e23]:
        - tab "Log in" [selected] [ref=f4e24] [cursor=pointer]
        - tab "Create account" [ref=f4e25] [cursor=pointer]
      - tablist "Login method" [ref=f4e26]:
        - button "Email" [ref=f4e27] [cursor=pointer]
        - button "Trio UID" [ref=f4e28] [cursor=pointer]
      - button "Continue with Google" [ref=f4e29] [cursor=pointer]
      - generic [ref=f4e35]: or continue with email
      - generic [ref=f4e37]:
        - generic [ref=f4e38]:
          - generic [ref=f4e39]: Email
          - textbox "Email" [ref=f4e40]:
            - /placeholder: you@example.com
        - generic [ref=f4e41]:
          - generic [ref=f4e42]: Password
          - generic [ref=f4e43]:
            - textbox "Password Show password Use 6+ characters." [ref=f4e44]:
              - /placeholder: Your password
            - button "Show password" [ref=f4e45] [cursor=pointer]: Show
          - generic [ref=f4e46]: Use 6+ characters.
        - button "Forgot password?" [ref=f4e49] [cursor=pointer]
        - paragraph [ref=f4e50]
        - button "Log in" [ref=f4e51] [cursor=pointer]
      - button [ref=f4e52] [cursor=pointer]:
        - text: New here?
        - strong [ref=f4e53]: Create account
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | test.describe('Trio Day QA Audit', () => {
  4   |   test.describe.configure({ mode: 'parallel' });
  5   |   test('Load index.html (mobile) and check for console errors', async ({ page }) => {
  6   |     const errors = [];
  7   |     page.on('console', msg => {
  8   |       if (msg.type() === 'error') {
  9   |         errors.push(msg.text());
  10  |       }
  11  |     });
  12  |     page.on('pageerror', err => {
  13  |       errors.push(err.message);
  14  |     });
  15  | 
  16  |     // Set mobile viewport FIRST
  17  |     await page.setViewportSize({ width: 390, height: 844 });
  18  |     await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
  19  |     await page.waitForTimeout(3000);
  20  | 
  21  |     console.log('Console errors on index.html:', errors);
  22  |     
  23  |     // Check basic elements - bottom-nav should be visible on mobile
  24  |     await expect(page.locator('.topbar')).toBeVisible();
  25  |     await expect(page.locator('.bottom-nav')).toBeVisible();
  26  |     await expect(page.locator('[data-nav="today"]')).toHaveClass(/active/);
  27  |     
  28  |     // Check for JS module errors (blank page check)
  29  |     const bodyText = await page.locator('body').textContent();
  30  |     expect(bodyText.length).toBeGreaterThan(100);
  31  |   });
  32  | 
  33  |   test('Navigate to all pages via bottom nav (mobile)', async ({ page }) => {
  34  |     const errors = [];
  35  |     page.on('console', msg => {
  36  |       if (msg.type() === 'error') errors.push(msg.text());
  37  |     });
  38  |     page.on('pageerror', err => errors.push(err.message));
  39  | 
  40  |     // Set mobile viewport FIRST
  41  |     await page.setViewportSize({ width: 390, height: 844 });
  42  |     
  43  |     // Today
  44  |     await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
  45  |     await page.waitForTimeout(2000);
  46  |     console.log('Today errors:', errors.filter(e => !e.includes('favicon')));
  47  | 
  48  |     // Discover
  49  |     await page.click('[data-nav="discover"]');
  50  |     await page.waitForURL('**/all-users.html');
  51  |     await page.waitForTimeout(2000);
  52  |     console.log('Discover errors:', errors.filter(e => !e.includes('favicon')));
  53  | 
  54  |     // Do
  55  |     await page.click('[data-nav="do"]');
  56  |     await page.waitForURL('**/tasks.html');
  57  |     await page.waitForTimeout(2000);
  58  |     console.log('Do errors:', errors.filter(e => !e.includes('favicon')));
  59  | 
  60  |     // Chat
  61  |     await page.click('[data-nav="chat"]');
  62  |     await page.waitForURL('**/chat.html');
  63  |     await page.waitForTimeout(2000);
  64  |     console.log('Chat errors:', errors.filter(e => !e.includes('favicon')));
  65  | 
  66  |     // You (Profile) - redirects to login since protected
> 67  |     await page.waitForSelector('[data-nav="you"]', { state: 'visible', timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  68  |     await page.click('[data-nav="you"]');
  69  |     await page.waitForURL('**/login.html**');
  70  |     await page.waitForTimeout(2000);
  71  |     console.log('Profile redirect errors:', errors.filter(e => !e.includes('favicon') && !e.includes('already declared')));
  72  |   });
  73  | 
  74  |   test('Login flow', async ({ page }) => {
  75  |     const errors = [];
  76  |     page.on('console', msg => {
  77  |       if (msg.type() === 'error') errors.push(msg.text());
  78  |     });
  79  |     page.on('pageerror', err => errors.push(err.message));
  80  | 
  81  |     await page.goto('http://localhost:5500/login.html', { waitUntil: 'networkidle' });
  82  |     await page.waitForTimeout(1000);
  83  |     
  84  |     // Check login form elements
  85  |     await expect(page.locator('#emailForm')).toBeVisible();
  86  |     await expect(page.locator('#email')).toBeVisible();
  87  |     await expect(page.locator('#password')).toBeVisible();
  88  |     await expect(page.locator('#googleBtn')).toBeVisible();
  89  |     
  90  |     // Test invalid email
  91  |     await page.fill('#email', 'invalid');
  92  |     await page.fill('#password', 'password');
  93  |     await page.click('#emailSubmitBtn');
  94  |     await page.waitForTimeout(500);
  95  |     const status = await page.locator('#authFormStatus').textContent();
  96  |     console.log('Invalid email status:', status);
  97  |     
  98  |     // Test invalid password (valid email format)
  99  |     await page.fill('#email', 'test@example.com');
  100 |     await page.fill('#password', 'wrong');
  101 |     await page.click('#emailSubmitBtn');
  102 |     await page.waitForTimeout(2000);
  103 |     const status2 = await page.locator('#authFormStatus').textContent();
  104 |     console.log('Wrong password status:', status2);
  105 |     
  106 |     console.log('Login errors:', errors.filter(e => !e.includes('favicon')));
  107 |   });
  108 | 
  109 |   test('Discover page - four lanes only (mobile)', async ({ page }) => {
  110 |     const errors = [];
  111 |     page.on('console', msg => {
  112 |       if (msg.type() === 'error') errors.push(msg.text());
  113 |     });
  114 |     page.on('pageerror', err => errors.push(err.message));
  115 | 
  116 |     await page.setViewportSize({ width: 390, height: 844 });
  117 |     await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'networkidle' });
  118 |     await page.waitForTimeout(3000);
  119 | 
  120 |     // Check four lane cards
  121 |     await expect(page.locator('.discover-lane-card')).toHaveCount(4);
  122 |     
  123 |     // Check lane labels
  124 |     const lanes = await page.locator('.lane-copy strong').allTextContents();
  125 |     console.log('Discover lanes:', lanes);
  126 |     
  127 |     // Should be Build, Learn, Challenge, Puzzle (not Game)
  128 |     expect(lanes).toContain('Build');
  129 |     expect(lanes).toContain('Learn');
  130 |     expect(lanes).toContain('Challenge');
  131 |     expect(lanes).toContain('Puzzle');
  132 |     expect(lanes).not.toContain('Game');
  133 |     
  134 |     console.log('Discover errors:', errors.filter(e => !e.includes('favicon')));
  135 |   });
  136 | 
  137 |   test('Activity pages load correctly (mobile)', async ({ page }) => {
  138 |     const errors = [];
  139 |     page.on('console', msg => {
  140 |       if (msg.type() === 'error') errors.push(msg.text());
  141 |     });
  142 |     page.on('pageerror', err => errors.push(err.message));
  143 | 
  144 |     await page.setViewportSize({ width: 390, height: 844 });
  145 | 
  146 |     // Test Build lane
  147 |     await page.goto('http://localhost:5500/build.html', { waitUntil: 'networkidle' });
  148 |     await page.waitForTimeout(3000);
  149 |     await expect(page.locator('#forgeList')).toBeVisible();
  150 |     console.log('Build page errors:', errors.filter(e => !e.includes('favicon')));
  151 | 
  152 |     // Test Learn lane
  153 |     await page.goto('http://localhost:5500/learn.html', { waitUntil: 'networkidle' });
  154 |     await page.waitForTimeout(3000);
  155 |     await expect(page.locator('#forgeList')).toBeVisible();
  156 |     console.log('Learn page errors:', errors.filter(e => !e.includes('favicon')));
  157 | 
  158 |     // Test Challenge lane
  159 |     await page.goto('http://localhost:5500/challenge.html', { waitUntil: 'networkidle' });
  160 |     await page.waitForTimeout(3000);
  161 |     await expect(page.locator('#forgeList')).toBeVisible();
  162 |     console.log('Challenge page errors:', errors.filter(e => !e.includes('favicon')));
  163 |   });
  164 | 
  165 |   test('Activity detail page loads', async ({ page }) => {
  166 |     const errors = [];
  167 |     page.on('console', msg => {
```