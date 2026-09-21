const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { name: 'Mobile 390px', width: 390, height: 844 },
  { name: 'Tablet 768px', width: 768, height: 1024 },
  { name: 'Desktop 1280px', width: 1280, height: 800 },
  { name: 'Desktop 1440px', width: 1440, height: 900 },
];

const PAGES = [
  { name: 'index.html', url: '/', public: true },
  { name: 'all-users.html (Discover)', url: '/all-users.html', public: true },
  { name: 'build.html (Forge Build)', url: '/build.html', public: true },
  { name: 'learn.html (Forge Learn)', url: '/learn.html', public: true },
  { name: 'challenge.html (Forge Challenge)', url: '/challenge.html', public: true },
  { name: 'tasks.html (Do)', url: '/tasks.html', public: true },
  { name: 'chat.html (Chat - PROTECTED)', url: '/chat.html', public: false },
  { name: 'profile.html (Profile - PROTECTED)', url: '/profile.html', public: false },
  { name: 'rooms.html (Rooms - PROTECTED)', url: '/rooms.html', public: false },
];

test.describe('Navigation Visibility Audit', () => {
  for (const viewport of VIEWPORTS) {
    for (const pageInfo of PAGES) {
      test(`${viewport.name} - ${pageInfo.name} nav items`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`http://localhost:5500${pageInfo.url}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        const result = await page.evaluate(() => {
          const items = [];
          
          // Bottom nav (mobile)
          const bottomNav = document.querySelector('.bottom-nav');
          if (bottomNav) {
            const btns = bottomNav.querySelectorAll('[data-nav]');
            btns.forEach(btn => {
              items.push({
                type: 'bottom-nav',
                key: btn.dataset.nav,
                href: btn.href,
                label: btn.querySelector('.nav-label')?.textContent?.trim() || '',
                visible: btn.offsetParent !== null
              });
            });
          }

          // Desktop rail
          const rail = document.querySelector('.nkm-rail');
          if (rail) {
            const btns = rail.querySelectorAll('[data-rail]');
            btns.forEach(btn => {
              items.push({
                type: 'rail',
                key: btn.dataset.rail,
                href: btn.href,
                label: btn.querySelector('.nav-label')?.textContent?.trim() || '',
                visible: btn.offsetParent !== null
              });
            });
          }

          // Header actions
          const headerActions = document.querySelector('.topbar-actions');
          if (headerActions) {
            const btns = headerActions.querySelectorAll('a, button');
            btns.forEach(btn => {
              if (btn.href && btn.href.includes('.html')) {
                items.push({
                  type: 'header',
                  key: btn.dataset.nav || btn.dataset.rail || btn.id || btn.className,
                  href: btn.href,
                  label: btn.textContent?.trim() || btn.ariaLabel || '',
                  visible: btn.offsetParent !== null
                });
              }
            });
          }

          // Check for any display:none or visibility:hidden on nav elements
          const hiddenChecks = {
            bottomNavHidden: bottomNav ? getComputedStyle(bottomNav).display === 'none' : true,
            railHidden: rail ? getComputedStyle(rail).display === 'none' : true,
          };

          return { items, hiddenChecks, url: window.location.href };
        });

        console.log(`\n=== ${viewport.name} - ${pageInfo.name} ===`);
        console.log('URL:', result.url);
        console.log('Bottom nav hidden:', result.hiddenChecks.bottomNavHidden);
        console.log('Rail hidden:', result.hiddenChecks.railHidden);
        result.items.forEach(item => {
          console.log(`  [${item.type}] ${item.key}: ${item.label} -> ${item.href} (visible: ${item.visible})`);
        });

        // Verify expected nav items are present
        const navKeys = result.items.map(i => i.key);
        
        // Canonical 4 navigation items should be accessible
        const coreItems = ['today', 'discover', 'do', 'you'];
        const missingCore = coreItems.filter(k => !navKeys.includes(k));
        if (missingCore.length > 0) {
          console.log('❌ MISSING CORE NAV:', missingCore);
        } else {
          console.log('✅ All 5 core nav items present');
        }

        // Legacy Create/Chat nav items must not reappear in the canonical primary navigation.
        expect(navKeys).not.toContain('create');
        expect(navKeys).not.toContain('chat');

        // Verify correct visibility for viewport
        if (viewport.width >= 840) {
          // Desktop: rail should be visible, bottom-nav hidden
          if (!result.hiddenChecks.railHidden) console.log('✅ Desktop rail visible');
          if (result.hiddenChecks.bottomNavHidden) console.log('✅ Bottom nav hidden on desktop');
        } else {
          // Mobile: bottom-nav visible, rail hidden
          if (!result.hiddenChecks.bottomNavHidden) console.log('✅ Mobile bottom nav visible');
          if (result.hiddenChecks.railHidden) console.log('✅ Rail hidden on mobile');
        }
      });
    }
  }
});