// Gates pages behind login. Include before page scripts.
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const ACTIVE_ROOM_KEY = "trio_active_room_v1";
function activeRoom() {
  try {
    const value = JSON.parse(sessionStorage.getItem(ACTIVE_ROOM_KEY) || "null");
    if (!value?.id || !value?.url) return null;
    if (Number(value.expiresAtMs || 0) && Number(value.expiresAtMs) <= Date.now()) {
      sessionStorage.removeItem(ACTIVE_ROOM_KEY);
      return null;
    }
    return value;
  } catch { return null; }
}

// Pages that are PUBLICLY ACCESSIBLE without authentication.
// Protected pages (chat, rooms, activity, profile, notifications, etc.) must NOT be here.
const PUBLIC_PAGES = new Set([
  'index.html',
  'login.html',
  '404.html',
  'sitemap.html',
  'offline.html',
  'privacy.html',
  'privacy-policy.html',
  'view_post.html',
  'all-users.html',    // Discover
  'build.html',        // Forge Build lane
  'learn.html',        // Forge Learn lane
  'challenge.html',    // Forge Challenge lane
  'puzzle.html',       // Forge Puzzle lane (if exists)
  'tasks.html',        // Do page
  'task-create.html',  // Create activity (public entry, but requires auth for actual creation)
  'task-detail.html',  // Community task detail
  'leaderboard.html',
  'admin-tasks.html',
  'voice-status.html',
  'search.html',
]);

onAuthStateChanged(auth, (user) => {
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isPublic = PUBLIC_PAGES.has(page);

  if (!user) {
    if (!isPublic) {
      const fullPage = (location.pathname.split("/").pop() || "index.html") + (location.search || "");
      window.location.href = `login.html?redirect=${encodeURIComponent(fullPage)}`;
    }
    return;
  }
  const active = activeRoom();
  const roomId = new URLSearchParams(location.search).get("id");
  if (active && !(page === "room.html" && roomId === active.id)) {
    window.location.replace(active.url);
    return;
  }
  document.documentElement.classList.add("auth-ok");
});
