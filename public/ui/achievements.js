/** Achievement popup + SVG progress ring helpers. */

let root;

function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'achievementOverlay';
  root.className = 'achievement-overlay';
  root.hidden = true;
  root.innerHTML = `
    <div class="achievement-card" role="status" aria-live="polite">
      <div class="achievement-burst" aria-hidden="true"></div>
      <div class="achievement-icon" id="achIcon">✅</div>
      <h3 id="achTitle">Achievement</h3>
      <p id="achSub"></p>
      <div id="achExtra" class="achievement-extra"></div>
      <button type="button" class="btn primary" id="achClose">Nice!</button>
    </div>`;
  document.body.appendChild(root);
  root.querySelector('#achClose').addEventListener('click', hideAchievement);
  root.addEventListener('click', e => { if (e.target === root) hideAchievement(); });
  return root;
}

export function showAchievement({ title, subtitle, icon, leveledUp, level, badges = [] } = {}) {
  const el = ensureRoot();
  el.querySelector('#achIcon').textContent = icon || '🎉';
  el.querySelector('#achTitle').textContent = title || 'Task complete!';
  el.querySelector('#achSub').textContent = subtitle || '';
  const extra = el.querySelector('#achExtra');
  const bits = [];
  if (leveledUp) bits.push(`<span class="ach-pill">Level ${level}!</span>`);
  (badges || []).forEach(b => bits.push(`<span class="ach-pill">${b.icon || '🏅'} ${b.name || ''}</span>`));
  extra.innerHTML = bits.join('');
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('open'));
  clearTimeout(showAchievement._t);
  showAchievement._t = setTimeout(hideAchievement, 4200);
  
  // Confetti celebration on achievement
  celebrateAchievement();
}

function celebrateAchievement() {
  const colors = ['#38bdf8', '#f59e0b', '#ef4444', '#10b981', '#a855f7'];
  const duration = 2.5;
  const end = Date.now() + duration * 1000;
  
  (function frame() {
    const now = Date.now();
    const t = Math.min(1, (now - (end - duration * 1000)) / (duration * 1000));
    
    // Create confetti piece
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = (duration - t) + 's';
    document.body.appendChild(confetti);
    
    confetti.addEventListener('animationend', () => confetti.remove());
    
    if (now < end) requestAnimationFrame(frame);
  })();
}

export function hideAchievement() {
  if (!root) return;
  root.classList.remove('open');
  setTimeout(() => { if (root) root.hidden = true; }, 280);
}

/** SVG progress ring HTML */
export function progressRingHtml(pct, { size = 56, stroke = 5, label = '' } = {}) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return `<div class="progress-ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <span class="ring-label">${label || Math.round(p) + '%'}</span>
  </div>`;
}
