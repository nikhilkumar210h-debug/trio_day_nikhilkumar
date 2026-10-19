// ui-kit.js — Merged UI utilities (toast.js + skeleton.js)
// Single source for toast notifications and loading skeletons.

// ──────────────────────────────────────────────────────────────────────────────
// Shared toast — single source for showToast (Phase 0 dedupe)
// Replaces duplicated 40-line implementations.
// ──────────────────────────────────────────────────────────────────────────────
export function showToast(message, type = "success") {
  document.getElementById("trioToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "trioToast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.style.cssText = `
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
    left: 50%;
    transform: translateX(-50%);
    background: ${type === "error" ? "#c0392b" : type === "warn" ? "#d4821a" : "#138843"};
    color: #fff;
    padding: 0.75rem 1.35rem;
    border-radius: 2rem;
    font-size: 0.95rem;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 5000;
    white-space: nowrap;
    max-width: calc(100vw - 2rem);
    text-align: center;
    animation: trioToastIn 0.25s ease;
  `;
  toast.textContent = message;
  if (!document.getElementById("trioToastStyle")) {
    const style = document.createElement("style");
    style.id = "trioToastStyle";
    style.textContent = "@keyframes trioToastIn { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }";
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  const dur = type === "error" || type === "warn" ? 5000 : 2800;
  setTimeout(() => toast?.remove(), dur);
}

// ──────────────────────────────────────────────────────────────────────────────
// Reusable loading states (Phase 1)
// Provides card/list/text skeletons using CSS .nkm-skeleton (no large DOM)
// ──────────────────────────────────────────────────────────────────────────────
export function skeletonCard({ lines = 2, avatar = true } = {}) {
  return `<div class="nkm-skeleton-card" style="padding:12px; display:flex; gap:12px; align-items:flex-start">
    ${avatar ? '<div class="nkm-skeleton" style="width:40px; height:40px; border-radius:50%; flex:none"></div>' : ""}
    <div style="flex:1; display:grid; gap:8px">
      <div class="nkm-skeleton" style="height:12px; width:40%"></div>
      ${Array(lines).fill(0).map((_, i) => `<div class="nkm-skeleton" style="height:12px; width:${i === lines - 1 ? "68%" : "92%"}"></div>`).join("")}
    </div>
  </div>`;
}
export function skeletonList(count = 3, opts) {
  return `<div class="nkm-skeleton-stack">${Array(count).fill(0).map(() => skeletonCard(opts)).join("")}</div>`;
}
export function skeletonAvatarRow() {
  return `<div style="display:flex; gap:8px">${Array(4).fill(0).map(() => `<div class="nkm-skeleton" style="width:64px; height:64px; border-radius:50%"></div>`).join("")}</div>`;
}
