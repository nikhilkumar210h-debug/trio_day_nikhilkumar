let _soundCtx = null;
let _lastSoundTime = 0;
let _enabled = true;
let _initialized = false;
let _globalBound = false;

function getCtx() {
  if (!_soundCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      _soundCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return _soundCtx;
}

function unlock() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function emitTone(ctx, freq, duration, volume, type) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(Math.max(0.001, volume), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { }
}

function playTone(freq, duration, volume, type = 'sine') {
  if (!_enabled) return;
  const now = Date.now();
  if (now - _lastSoundTime < 45) return;
  _lastSoundTime = now;

  const ctx = getCtx();
  if (!ctx) return;

  const play = () => {
    if (!_enabled || !ctx || ctx.state !== 'running') return;
    emitTone(ctx, freq, duration, volume, type);
    if (navigator.vibrate && duration <= 0.08) {
      try { navigator.vibrate(20); } catch { }
    }
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

function isInteractive(target) {
  const el = target instanceof Element ? target.closest(
    'button:not([disabled]), a[href], [role="button"], summary, input[type="checkbox"], input[type="radio"], select'
  ) : null;
  if (!el) return false;
  if (el.closest('[data-sound="none"], audio, video')) return false;
  if (el.dataset.sound === 'none') return false;
  return true;
}

function bindGlobalInteractions() {
  if (_globalBound) return;
  _globalBound = true;

  // First user gesture unlocks Web Audio on browsers that require a user activation.
  document.addEventListener('pointerdown', () => unlock(), { passive: true, capture: true });

  // Shared fallback click feedback for pages/actions that do not have a custom sound.
  // Existing SoundManager calls happen during the same click and update _lastSoundTime,
  // so they naturally suppress this fallback instead of producing two identical clicks.
  document.addEventListener('click', (event) => {
    if (!isInteractive(event.target)) return;
    setTimeout(() => {
      if (!_enabled) return;
      if (Date.now() - _lastSoundTime < 100) return;
      playTone(680, 0.035, 0.055, 'sine');
    }, 0);
  });
}

export const SoundManager = {
  init() {
    if (!_initialized) {
      _initialized = true;
      try { _enabled = localStorage.getItem('trio_sound_enabled') !== 'false'; } catch { _enabled = true; }
      bindGlobalInteractions();
    } else {
      try { _enabled = localStorage.getItem('trio_sound_enabled') !== 'false'; } catch { }
    }
  },
  isEnabled() { return _enabled; },
  toggle(on) {
    _enabled = Boolean(on);
    try { localStorage.setItem('trio_sound_enabled', String(_enabled)); } catch { }
    if (_enabled) unlock();
  },
  click() { playTone(700, 0.04, 0.08); },
  send() { playTone(880, 0.08, 0.1); setTimeout(() => playTone(1100, 0.06, 0.08), 60); },
  delete() { playTone(220, 0.1, 0.1, 'triangle'); },
  like() { playTone(1000, 0.06, 0.07); setTimeout(() => playTone(1300, 0.05, 0.06), 50); },
  success() { playTone(660, 0.08, 0.1); setTimeout(() => playTone(880, 0.08, 0.1), 80); setTimeout(() => playTone(1100, 0.1, 0.08), 160); },
  storyTap() { playTone(500, 0.03, 0.06); },
  moodSelect() { playTone(900, 0.04, 0.06); },
};