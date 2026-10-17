// public/ui/sound.js — Zero-KB Web Audio Sound Effects (Phase 3)
// No external audio files. All tones synthesized via browser AudioContext.
// Mute toggle persisted in localStorage. Tactile feedback for voting,
// clue reveals, countdown ticks, and winning a challenge.

let _ctx = null;
let _enabled = true;
let _unlocked = false;

function ctx() {
  if (!_ctx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      _ctx = new Ctx();
    } catch { return null; }
  }
  return _ctx;
}

function unlock() {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  _unlocked = true;
}

function tone(freq, duration, volume, type = 'sine', when = 0) {
  const c = ctx();
  if (!c || !_enabled) return;
  const t = when > 0 ? c.currentTime + when : c.currentTime;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + duration);
  } catch { }
}

export const SoundFX = {
  init() {
    try { _enabled = localStorage.getItem('trio_sfx_enabled') !== 'false'; } catch { _enabled = true; }
    // Unlock on first user gesture
    const once = () => { unlock(); document.removeEventListener('pointerdown', once); };
    document.addEventListener('pointerdown', once, { passive: true, capture: true });
  },
  isEnabled() { return _enabled; },
  toggle(on) {
    _enabled = Boolean(on);
    try { localStorage.setItem('trio_sfx_enabled', String(_enabled)); } catch { }
    if (_enabled) unlock();
  },
  // Subtle tactile click for voting / option selection
  voteClick() { tone(900, 0.03, 0.06, 'sine'); },
  // Clue reveal — ascending "unlock" feel
  clueReveal() {
    tone(660, 0.08, 0.08, 'sine');
    setTimeout(() => tone(990, 0.12, 0.1, 'sine'), 60);
  },
  // Countdown tick — subtle, not annoying
  countdownTick() { tone(1200, 0.02, 0.04, 'sine'); },
  // Win / correct answer fanfare
  win() {
    tone(523, 0.1, 0.1, 'sine');
    setTimeout(() => tone(659, 0.1, 0.1, 'sine'), 90);
    setTimeout(() => tone(784, 0.15, 0.12, 'sine'), 180);
    setTimeout(() => tone(1047, 0.25, 0.15, 'sine'), 270);
  },
  // XP multiplier badge pop
  xpPop() { tone(880, 0.06, 0.09, 'sine'); setTimeout(() => tone(1320, 0.08, 0.1, 'sine'), 50); },
  // Undercover AI revealed — slightly mysterious
  undercoverReveal() {
    tone(440, 0.15, 0.08, 'sawtooth');
    setTimeout(() => tone(330, 0.2, 0.07, 'sawtooth'), 120);
  },
  // Gentle error / locked
  locked() { tone(220, 0.15, 0.06, 'sawtooth'); },
};

// Auto-init on first gesture
SoundFX.init();
