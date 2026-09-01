// ui/skeleton.js — Reusable loading states (Phase 1)
// Provides card/list/text skeletons using CSS .nkm-skeleton (no large DOM)
export function skeletonCard({ lines = 2, avatar = true } = {}) {
  return `<div class="nkm-skeleton-card" style="padding:12px; display:flex; gap:12px; align-items:flex-start">
    ${avatar ? '<div class="nkm-skeleton" style="width:40px; height:40px; border-radius:50%; flex:none"></div>' : ''}
    <div style="flex:1; display:grid; gap:8px">
      <div class="nkm-skeleton" style="height:12px; width:40%"></div>
      ${Array(lines).fill(0).map((_,i) => `<div class="nkm-skeleton" style="height:12px; width:${i===lines-1? '68%':'92%'}"></div>`).join('')}
    </div>
  </div>`;
}
export function skeletonList(count = 3, opts) {
  return `<div class="nkm-skeleton-stack">${Array(count).fill(0).map(() => skeletonCard(opts)).join('')}</div>`;
}
export function skeletonAvatarRow() {
  return `<div style="display:flex; gap:8px">${Array(4).fill(0).map(() => `<div class="nkm-skeleton" style="width:64px; height:64px; border-radius:50%"></div>`).join('')}</div>`;
}
