import { SoundManager } from './sound-manager.js';
/* Trio Day 2.0 — Theme System (Phase 3)
   Single global theme preference for the entire application.
   ═══════════════════════════════════════════════════════════ */
const THEME_KEY = 'trio-theme';
const LEGACY_THEME_KEYS = ['trio_theme']; // older pages wrote this key
const THEME_ATTR = 'data-theme';
const LIGHT_META = '#f8fafc';
const DARK_META = '#0a0f1a';
const THEME_VISUAL_HREF = 'styles/theme-visual.css?v=1';

function ensureVisualStyles() {
  if (document.querySelector('link[data-trio-visual]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = THEME_VISUAL_HREF;
  link.dataset.trioVisual = 'true';
  document.head.appendChild(link);
}

function getSavedTheme() {
  try {
    // Canonical key first
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
    // Migrate legacy key once if present
    for (const k of LEGACY_THEME_KEYS) {
      const old = localStorage.getItem(k);
      if (old === 'light' || old === 'dark') {
        localStorage.setItem(THEME_KEY, old);
        return old;
      }
    }
  } catch { }
  return null;
}

function setSavedTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { }
}

function getSystemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch { return 'dark'; }
}

// Resolve the effective theme WITHOUT persisting (used pre-paint).
function resolveTheme() {
  return getSavedTheme() || getSystemTheme();
}

function applyTheme(theme, { persist = true } = {}) {
  if (theme !== 'light' && theme !== 'dark') theme = 'dark';
  document.documentElement.setAttribute(THEME_ATTR, theme);
  if (persist) setSavedTheme(theme);
  // Update meta theme-color for browser UI chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? LIGHT_META : DARK_META);
}

function initTheme() {
  ensureVisualStyles();
  // System mode must follow the OS without turning the resolved value into a
  // persisted user preference.
  applyTheme(resolveTheme(), { persist: !!getSavedTheme() });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute(THEME_ATTR) || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

function createThemeToggle() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn';
  btn.setAttribute('aria-label', 'Toggle theme');
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = `🌙`;
  btn.addEventListener('click', () => {
    const theme = toggleTheme();
    btn.setAttribute('aria-pressed', theme === 'light');
    updateThemeIcon(btn, theme);
  });
  updateThemeIcon(btn, document.documentElement.getAttribute(THEME_ATTR) || 'dark');
  return btn;
}

function updateThemeIcon(btn, theme) {
  btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

// Listen for system theme changes (only if user hasn't set a preference)
function watchSystemTheme() {
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      if (!getSavedTheme()) applyTheme(e.matches ? 'light' : 'dark', { persist: false });
    };
    mediaQuery.addEventListener ? mediaQuery.addEventListener('change', handler) : mediaQuery.addListener(handler);
  } catch { }
}

// Sound is a shared app capability; initialize it on every themed page so the setting persists everywhere.
SoundManager.init();

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initTheme(); watchSystemTheme(); });
} else {
  initTheme();
  watchSystemTheme();
}

// Export for use in other modules
window.TrioTheme = { initTheme, toggleTheme, applyTheme, resolveTheme, createThemeToggle };