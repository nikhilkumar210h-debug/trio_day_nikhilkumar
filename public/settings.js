/* Trio Day — Settings Module (Phase 4)
   Handles all interactive settings: theme, sound, notifications, cache, account
*/
import { auth } from './firebase-init.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase-init.js';
import { SoundManager } from './sound-manager.js';
import { showToast } from './ui/toast.js';
import { createSheet } from './ui/sheet.js';
import { trioCache } from './trio-cache.js';
import { loadNotificationSettings, renderNotificationSettings, saveNotificationSetting, initNotificationSettingsUI } from './services/notificationSettings.js';
import { enableOneSignalPush } from './onesignal.js';

const $ = id => document.getElementById(id);

// ─── Theme Selection ────────────────────────────────────────────────────────
const THEME_LABELS = {
  dark: { label: 'Dark', icon: '🌙', desc: 'Always use dark mode' },
  light: { label: 'Light', icon: '☀️', desc: 'Always use light mode' },
  system: { label: 'System', icon: '◐', desc: 'Match OS setting' }
};

function renderThemeChoices() {
  const container = $('themeChoices');
  if (!container) return;
  const current = localStorage.getItem('trio-theme') || 'system';
  
  container.innerHTML = Object.entries(THEME_LABELS).map(([value, { label, icon, desc }]) => `
    <button type="button" 
            class="theme-choice${value === current ? ' is-selected' : ''}" 
            data-theme="${value}"
            role="radio" 
            aria-checked="${value === current}"
            style="
              display:grid;
              grid-template-columns:40px 1fr auto;
              align-items:center;
              gap:12px;
              padding:14px 16px;
              border:1px solid var(--color-border);
              border-radius:var(--radius-md);
              background:var(--color-glass);
              color:var(--color-ink);
              font:inherit;
              text-align:left;
              cursor:pointer;
              transition:background var(--duration-fast),border-color var(--duration-fast),transform var(--duration-fast);
            ">
      <span style="font-size:20px">${icon}</span>
      <div>
        <div style="font-weight:600;font-size:var(--text-base)">${label}</div>
        <div style="font-size:var(--text-xs);color:var(--color-ink-muted)">${desc}</div>
      </div>
      ${value === current ? '<span style="color:var(--color-primary);font-weight:bold">✓</span>' : ''}
    </button>
  `).join('');

  container.querySelectorAll('.theme-choice').forEach(btn => {
    btn.addEventListener('click', () => selectTheme(btn.dataset.theme));
    btn.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('is-selected')) {
        btn.style.background = 'var(--color-glass-hover)';
        btn.style.borderColor = 'var(--color-border-strong)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn.classList.contains('is-selected')) {
        btn.style.background = 'var(--color-glass)';
        btn.style.borderColor = 'var(--color-border)';
      }
    });
  });
}

async function selectTheme(theme) {
  try {
    if (theme === 'system') {
      localStorage.removeItem('trio-theme');
      window.TrioTheme?.initTheme();
    } else {
      window.TrioTheme?.applyTheme(theme);
    }
    renderThemeChoices();
    SoundManager.click();
    showToast(`Theme set to ${THEME_LABELS[theme].label}`);
  } catch (e) {
    console.error('Theme selection failed:', e);
    showToast('Failed to change theme', 'error');
  }
}

// ─── Sound & Haptics ────────────────────────────────────────────────────────
function initSoundToggles() {
  const soundToggle = $('soundToggle');
  const hapticToggle = $('hapticToggle');
  
  if (soundToggle) {
    // Load saved preference (default: enabled)
    const soundEnabled = localStorage.getItem('trio_sound_enabled') !== 'false';
    soundToggle.checked = soundEnabled;
    SoundManager.toggle(soundEnabled);
    
    soundToggle.addEventListener('change', () => {
      const enabled = soundToggle.checked;
      SoundManager.toggle(enabled);
      localStorage.setItem('trio_sound_enabled', String(enabled));
      showToast(enabled ? 'Sound effects enabled' : 'Sound effects disabled');
      SoundManager.click();
    });
  }
  
  if (hapticToggle) {
    const hapticEnabled = localStorage.getItem('trio_haptic_enabled') !== 'false';
    hapticToggle.checked = hapticEnabled;
    
    hapticToggle.addEventListener('change', () => {
      const enabled = hapticToggle.checked;
      localStorage.setItem('trio_haptic_enabled', String(enabled));
      showToast(enabled ? 'Haptic feedback enabled' : 'Haptic feedback disabled');
      SoundManager.click();
    });
  }
}

// ─── Notifications ──────────────────────────────────────────────────────────
async function initNotificationSettings(user) {
  const container = $('notificationSettings');
  if (!container) return;
  
  try {
    // First check OneSignal permission status
    let oneSignalStatus = 'unknown';
    if ('Notification' in window) {
      oneSignalStatus = Notification.permission;
    }
    
    // Load Firestore notification settings
    const settings = await loadNotificationSettings(user.uid);
    
    // Render the settings UI
    renderNotificationSettings(container, settings, async (key, value) => {
      await saveNotificationSetting(user.uid, key, value);
      SoundManager.click();
    });
    
    // Add master push toggle handler
    const pushToggle = container.querySelector('input[data-setting="pushEnabled"]');
    if (pushToggle) {
      pushToggle.addEventListener('change', async (e) => {
        if (e.target.checked && oneSignalStatus !== 'granted') {
          // Request permission
          try {
            await enableOneSignalPush(user);
            showToast('Push notifications enabled');
          } catch (err) {
            console.error('Failed to enable push:', err);
            pushToggle.checked = false;
            showToast('Failed to enable push notifications', 'error');
          }
        }
      });
    }
  } catch (err) {
    console.error('Failed to load notification settings:', err);
    container.innerHTML = `
      <div style="padding:16px;text-align:center;color:var(--color-ink-muted)">
        Failed to load notification settings
      </div>
    `;
  }
}

// ─── Clear Cache ────────────────────────────────────────────────────────────
function initClearCache() {
  const btn = $('clearCacheBtn');
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    const { open, close } = createSheet({
      title: 'Clear Local Cache?',
      content: `
        <div style="display:grid;gap:12px">
          <p style="color:var(--color-ink-muted);font-size:var(--text-sm);line-height:1.5">
            This will remove all cached user data, images, and temporary files from this device.
            You may need to reload some content afterwards.
          </p>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="nkm-btn" type="button" data-cancel>Cancel</button>
            <button class="nkm-btn nkm-btn--primary" type="button" data-confirm style="background:var(--color-danger);border-color:var(--color-danger)">Clear Cache</button>
          </div>
        </div>
      `
    });
    open();
    
    const confirmBtn = document.querySelector('[data-confirm]');
    const cancelBtn = document.querySelector('[data-cancel]');
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        close();
        try {
          trioCache.clear();
          // Also clear other localStorage items except theme and auth
          const keepKeys = ['trio-theme', 'trio_sound_enabled', 'trio_haptic_enabled', 'firebase:authUser'];
          const allKeys = Object.keys(localStorage);
          allKeys.forEach(key => {
            if (!keepKeys.includes(key) && !key.startsWith('trio_')) {
              localStorage.removeItem(key);
            }
          });
          showToast('Local cache cleared successfully');
          SoundManager.success();
        } catch (e) {
          console.error('Clear cache failed:', e);
          showToast('Failed to clear cache', 'error');
        }
      });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', close);
  });
}

// ─── Account Actions ────────────────────────────────────────────────────────
async function initAccountActions(user) {
  const copyUidBtn = $('copyUidBtn');
  const signOutBtn = $('signOutBtn');
  
  if (copyUidBtn) {
    copyUidBtn.addEventListener('click', async () => {
      try {
        const uid = user.uid;
        // Try to get the TRIO UID from Firestore
        const userDoc = await getDoc(doc(db, 'users', uid));
        const trioUid = userDoc.exists() ? (userDoc.data().userId || uid) : uid;
        
        await navigator.clipboard.writeText(trioUid);
        showToast(`Copied ${trioUid} to clipboard`);
        SoundManager.success();
      } catch (e) {
        console.error('Copy UID failed:', e);
        showToast('Failed to copy UID', 'error');
      }
    });
  }
  
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      const { open, close } = createSheet({
        title: 'Sign Out?',
        content: `
          <div style="display:grid;gap:12px">
            <p style="color:var(--color-ink-muted);font-size:var(--text-sm);line-height:1.5">
              Are you sure you want to sign out? You'll need to sign in again to access your account.
            </p>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="nkm-btn" type="button" data-cancel>Cancel</button>
              <button class="nkm-btn nkm-btn--primary" type="button" data-confirm style="background:var(--color-danger);border-color:var(--color-danger)">Sign Out</button>
            </div>
          </div>
        `
      });
      open();
      
      const confirmBtn = document.querySelector('[data-confirm]');
      const cancelBtn = document.querySelector('[data-cancel]');
      
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          close();
          try {
            await signOut(auth);
            showToast('Signed out successfully');
            SoundManager.success();
            setTimeout(() => location.href = 'login.html', 800);
          } catch (e) {
            console.error('Sign out failed:', e);
            showToast('Failed to sign out', 'error');
          }
        });
      }
      if (cancelBtn) cancelBtn.addEventListener('click', close);
    });
  }
  
  // Update app version
  const versionEl = $('appVersion');
  if (versionEl) {
    try {
      const manifest = await fetch('manifest.json').then(r => r.json());
      versionEl.textContent = `v${manifest.version || '1.0.0'}`;
    } catch {
      versionEl.textContent = 'v1.0.0';
    }
  }
}

// ─── Initialize ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderThemeChoices();
  initSoundToggles();
  initClearCache();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await initNotificationSettings(user);
      initAccountActions(user);
    } else {
      // Redirect to login if not authenticated
      location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname);
    }
  });
});

// Export for potential external use
window.TrioSettings = {
  renderThemeChoices,
  selectTheme
};