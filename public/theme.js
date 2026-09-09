/* Trio Day 2.0 — Theme System
   Handles dark/light theme switching with persistence.
   ═══════════════════════════════════════════════════════════════ */
const THEME_KEY = 'trio-theme';
const THEME_ATTR = 'data-theme';

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch { return null; }
}

function setSavedTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { }
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute(THEME_ATTR, theme);
  setSavedTheme(theme);
  // Update meta theme-color for browser UI
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#0a0f1a');
  }
}

function initTheme() {
  const saved = getSavedTheme();
  if (saved) {
    applyTheme(saved);
  } else {
    // First visit - use system preference
    applyTheme(getSystemTheme());
  }
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
  btn.innerHTML = `🌙`; // Will be updated by updateThemeIcon
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
  const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  const handler = (e) => {
    const saved = getSavedTheme();
    if (!saved) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  };
  mediaQuery.addEventListener ? mediaQuery.addEventListener('change', handler) : mediaQuery.addListener(handler);
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initTheme(); watchSystemTheme(); });
} else {
  initTheme();
  watchSystemTheme();
}

// Export for use in other modules
window.TrioTheme = { initTheme, toggleTheme, applyTheme, createThemeToggle };