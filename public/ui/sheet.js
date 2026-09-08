// ui/sheet.js — Single reusable bottom-sheet / dialog system (Phase 1)
// Mobile: 92vh sheet with handle + safe-area + keyboard-aware (dvh)
// Desktop: centered dialog (600px breakpoint)
// No duplicate modal implementations — reuse this.

export function createSheet({ title = '', content = '', actions = '' } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'nkm-scrim';
  scrim.hidden = true;
  const sheet = document.createElement('div');
  sheet.className = 'nkm-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="nkm-sheet-handle" aria-hidden="true"></div>
    <div class="nkm-sheet-head"><h2>${title}</h2><button class="nkm-btn nkm-btn--sm nkm-sheet-close" type="button" aria-label="Close">✕</button></div>
    <div class="nkm-sheet-body">${content}</div>
    ${actions ? `<div class="nkm-sheet-actions">${actions}</div>` : ''}`;
  document.body.append(scrim, sheet);
  const close = () => {
    sheet.classList.remove('is-open');
    scrim.classList.remove('is-open');
    setTimeout(() => { sheet.hidden = true; scrim.hidden = true; document.body.style.overflow = ''; }, 220);
    document.removeEventListener('keydown', onKey);
  };
  const open = () => {
    sheet.hidden = false; scrim.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { scrim.classList.add('is-open'); sheet.classList.add('is-open'); });
    document.addEventListener('keydown', onKey);
    sheet.querySelector('.nkm-sheet-close')?.focus();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('click', close);
  sheet.querySelector('.nkm-sheet-close')?.addEventListener('click', close);
  // Drag to dismiss (mobile): swipe down on handle/head
  let startY = 0;
  const head = sheet.querySelector('.nkm-sheet-head');
  head?.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  head?.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 80) close();
  });
  return { scrim, sheet, open, close, body: sheet.querySelector('.nkm-sheet-body') };
}

// Convenience: global search sheet (uses existing trio-cache + navigation)
export function openSearchSheet() {
  const { open, body } = createSheet({
    title: 'Search',
    content: `<div class="nkm-search-wrap"><input class="nkm-search" id="nkmGlobalSearch" placeholder="Search name, TRIO-ID or post…" autocomplete="off"><div id="nkmSearchResults" style="margin-top:12px"></div></div>`
  });
  open();
  const input = body.querySelector('#nkmGlobalSearch');
  input?.focus();
  return body;
}
