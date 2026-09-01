let _soundCtx = null;
let _lastSoundTime = 0;
let _enabled = true;

function getCtx() {
  if (!_soundCtx) {
    try { _soundCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (_soundCtx.state === 'suspended') _soundCtx.resume();
  return _soundCtx;
}

function playTone(freq, duration, volume, type = 'sine') {
  if (!_enabled) return;
  const now = Date.now();
  if (now - _lastSoundTime < 40) return;
  _lastSoundTime = now;
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
  if (navigator.vibrate) navigator.vibrate(35);
}

export const SoundManager = {
  init() {
    try { _enabled = localStorage.getItem('trio_sound_enabled') !== 'false'; } catch { _enabled = true; }
  },
  isEnabled() { return _enabled; },
  toggle(on) {
    _enabled = on;
    try { localStorage.setItem('trio_sound_enabled', String(on)); } catch { }
  },
  click() { playTone(700, 0.04, 0.08); },
  send() { playTone(880, 0.08, 0.1); setTimeout(() => playTone(1100, 0.06, 0.08), 60); },
  delete() { playTone(220, 0.1, 0.1, 'triangle'); },
  like() { playTone(1000, 0.06, 0.07); setTimeout(() => playTone(1300, 0.05, 0.06), 50); },
  success() { playTone(660, 0.08, 0.1); setTimeout(() => playTone(880, 0.08, 0.1), 80); setTimeout(() => playTone(1100, 0.1, 0.08), 160); },
  storyTap() { playTone(500, 0.03, 0.06); },
  moodSelect() { playTone(900, 0.04, 0.06); },
};