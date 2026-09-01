// Shared toast — single source for showToast (Phase 0 dedupe)
// Replaces duplicated 40-line implementations in task-create.js:18 and admin-tasks.js:18
export function showToast(message, type = 'success') {
  document.getElementById('trioToast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'trioToast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = `
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#c0392b' : type === 'warn' ? '#d4821a' : '#138843'};
    color: #fff;
    padding: 0.75rem 1.35rem;
    border-radius: 2rem;
    font-size: 0.95rem;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 9999;
    white-space: nowrap;
    max-width: calc(100vw - 2rem);
    text-align: center;
    animation: trioToastIn 0.25s ease;
  `;
  toast.textContent = message;
  if (!document.getElementById('trioToastStyle')) {
    const style = document.createElement('style');
    style.id = 'trioToastStyle';
    style.textContent = '@keyframes trioToastIn { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }';
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  const dur = type === 'error' || type === 'warn' ? 5000 : 2800;
  setTimeout(() => toast?.remove(), dur);
}
